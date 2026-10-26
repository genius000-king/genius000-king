package com.genius.tvhub.engine.adb.agent

import java.util.Base64

/**
 * The line protocol between the app and [ShellAgent]. Pure, so both ends are tested on the JVM.
 * One command per line; the agent answers each with a line starting with [OK] or [ERR], so stray
 * output from app_process (linker warnings...) is ignored. Points are normalized (0..1).
 */
sealed interface AgentCommand {
    data class Key(val code: Int, val longPress: Boolean) : AgentCommand
    data class Text(val text: String) : AgentCommand
    data class Tap(val x: Float, val y: Float, val longPress: Boolean) : AgentCommand
    data class Swipe(val points: List<Pair<Float, Float>>, val durationMillis: Long) : AgentCommand
    data object Ping : AgentCommand
}

object AgentProtocol {
    const val READY = "@@ready"
    const val OK = "@@ok"
    const val ERR = "@@err"

    fun encode(c: AgentCommand): String = when (c) {
        is AgentCommand.Key -> "key ${c.code} ${flag(c.longPress)}"
        // Base64: text may hold spaces, newlines or anything else.
        is AgentCommand.Text -> "text ${Base64.getEncoder().encodeToString(c.text.toByteArray())}"
        is AgentCommand.Tap -> "tap ${c.x} ${c.y} ${flag(c.longPress)}"
        is AgentCommand.Swipe -> "swipe ${c.durationMillis} " + c.points.joinToString(" ") { "${it.first},${it.second}" }
        AgentCommand.Ping -> "ping"
    }

    fun decode(line: String): AgentCommand? = runCatching {
        val p = line.trim().split(' ')
        when (p[0]) {
            "key" -> AgentCommand.Key(p[1].toInt(), p.getOrNull(2) == "1")
            "text" -> AgentCommand.Text(String(Base64.getDecoder().decode(p[1])))
            "tap" -> AgentCommand.Tap(unit(p[1]), unit(p[2]), p.getOrNull(3) == "1")
            "swipe" -> AgentCommand.Swipe(
                p.drop(2).map { it.split(',').let { xy -> unit(xy[0]) to unit(xy[1]) } }.also { require(it.size >= 2) },
                p[1].toLong().coerceIn(1, 10_000),
            )
            "ping" -> AgentCommand.Ping
            else -> null
        }
    }.getOrNull()

    private fun flag(b: Boolean) = if (b) "1" else "0"
    private fun unit(s: String) = s.toFloat().also { require(it in 0f..1f) }
}
