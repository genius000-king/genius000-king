package com.genius.tvhub.engine.adb.agent

import android.os.SystemClock
import android.view.InputDevice
import android.view.InputEvent
import android.view.KeyCharacterMap
import android.view.KeyEvent
import android.view.MotionEvent
import java.lang.reflect.Method

/**
 * Runs as the `shell` user, started over ADB with `app_process` from TV Hub's own APK, so it may
 * inject input like the physical remote does (the shell user holds INJECT_EVENTS). It reads
 * [AgentProtocol] lines on stdin and answers each on stdout. No Android Context exists here: only
 * framework classes that work in a bare process.
 *
 * Arguments: screen width and height in pixels (normalized points are scaled by them).
 */
object ShellAgent {
    private const val INJECT_ASYNC = 0
    private const val LONG_PRESS_MS = 600L

    @JvmStatic
    fun main(args: Array<String>) {
        val width = args.getOrNull(0)?.toIntOrNull() ?: 1920
        val height = args.getOrNull(1)?.toIntOrNull() ?: 1080
        val injector = try {
            Injector()
        } catch (t: Throwable) {
            println("${AgentProtocol.ERR} cannot reach InputManager: ${t.javaClass.simpleName}")
            return
        }
        println(AgentProtocol.READY)
        System.out.flush()
        val input = System.`in`.bufferedReader()
        while (true) {
            val line = input.readLine() ?: return
            val cmd = AgentProtocol.decode(line)
            val ok = try {
                when (cmd) {
                    null -> false
                    AgentCommand.Ping -> true
                    is AgentCommand.Key -> injector.key(cmd.code, cmd.longPress)
                    is AgentCommand.Text -> injector.text(cmd.text)
                    is AgentCommand.Tap -> injector.tap(cmd.x * width, cmd.y * height, cmd.longPress)
                    is AgentCommand.Swipe -> injector.swipe(cmd.points.map { it.first * width to it.second * height }, cmd.durationMillis)
                }
            } catch (t: Throwable) {
                false
            }
            println(if (ok) AgentProtocol.OK else AgentProtocol.ERR)
            System.out.flush()
        }
    }

    private class Injector {
        private val manager: Any
        private val inject: Method

        init {
            // Android 14 moved injection to InputManagerGlobal; older versions have it on InputManager.
            val (target, method) = runCatching {
                val global = Class.forName("android.hardware.input.InputManagerGlobal")
                global.getMethod("getInstance").invoke(null)!! to global.getMethod("injectInputEvent", InputEvent::class.java, Int::class.javaPrimitiveType)
            }.getOrElse {
                val im = Class.forName("android.hardware.input.InputManager")
                im.getMethod("getInstance").invoke(null)!! to im.getMethod("injectInputEvent", InputEvent::class.java, Int::class.javaPrimitiveType)
            }
            manager = target
            inject = method
        }

        private fun send(e: InputEvent) = inject.invoke(manager, e, INJECT_ASYNC) as Boolean

        fun key(code: Int, longPress: Boolean): Boolean {
            val down = SystemClock.uptimeMillis()
            if (!send(keyEvent(down, down, KeyEvent.ACTION_DOWN, code, 0, 0))) return false
            if (longPress) {
                Thread.sleep(LONG_PRESS_MS)
                send(keyEvent(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_DOWN, code, 1, KeyEvent.FLAG_LONG_PRESS))
            }
            return send(keyEvent(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, code, 0, 0))
        }

        /** ASCII-like text as real key presses; anything the keyboard map can't type is refused. */
        fun text(text: String): Boolean {
            val events = KeyCharacterMap.load(KeyCharacterMap.VIRTUAL_KEYBOARD).getEvents(text.toCharArray()) ?: return false
            return events.all { e ->
                send(KeyEvent(e.downTime, e.eventTime, e.action, e.keyCode, e.repeatCount, e.metaState, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, 0, InputDevice.SOURCE_KEYBOARD))
            }
        }

        fun tap(x: Float, y: Float, longPress: Boolean): Boolean {
            val down = SystemClock.uptimeMillis()
            if (!send(motion(down, down, MotionEvent.ACTION_DOWN, x, y))) return false
            Thread.sleep(if (longPress) LONG_PRESS_MS else 30)
            return send(motion(down, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, x, y))
        }

        fun swipe(points: List<Pair<Float, Float>>, durationMillis: Long): Boolean {
            val down = SystemClock.uptimeMillis()
            // Interpolate so apps see a continuous drag (fling velocity comes from these samples).
            val steps = (durationMillis / 8).toInt().coerceIn(points.size, 120)
            val path = resample(points, steps)
            if (!send(motion(down, down, MotionEvent.ACTION_DOWN, path[0].first, path[0].second))) return false
            for (i in 1 until path.size) {
                Thread.sleep((durationMillis / path.size).coerceAtLeast(1))
                send(motion(down, SystemClock.uptimeMillis(), MotionEvent.ACTION_MOVE, path[i].first, path[i].second))
            }
            val last = path.last()
            return send(motion(down, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, last.first, last.second))
        }

        private fun keyEvent(down: Long, at: Long, action: Int, code: Int, repeat: Int, flags: Int) =
            KeyEvent(down, at, action, code, repeat, 0, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, flags or KeyEvent.FLAG_FROM_SYSTEM, InputDevice.SOURCE_KEYBOARD)

        private fun motion(down: Long, at: Long, action: Int, x: Float, y: Float): MotionEvent =
            MotionEvent.obtain(down, at, action, x, y, 0).apply { source = InputDevice.SOURCE_TOUCHSCREEN }

        private fun resample(points: List<Pair<Float, Float>>, n: Int): List<Pair<Float, Float>> {
            if (points.size >= n) return points
            val out = ArrayList<Pair<Float, Float>>(n)
            val segments = points.size - 1
            for (i in 0 until n) {
                val t = i.toFloat() / (n - 1) * segments
                val s = t.toInt().coerceAtMost(segments - 1)
                val f = t - s
                val (ax, ay) = points[s]
                val (bx, by) = points[s + 1]
                out += (ax + (bx - ax) * f) to (ay + (by - ay) * f)
            }
            return out
        }
    }
}
