package com.genius.tvhub.engine.input.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.ComponentName
import android.content.Intent
import android.graphics.Path
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.genius.tvhub.core.common.Log
import com.genius.tvhub.engine.input.api.FocusedField
import com.genius.tvhub.engine.input.api.InputPrefs
import com.genius.tvhub.engine.input.cursor.CursorModel
import com.genius.tvhub.engine.input.cursor.RemoteMouse
import com.genius.tvhub.engine.input.gesture.GesturePlanner
import com.genius.tvhub.engine.input.gesture.Stroke
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * The one Android component input needs. It lives while the user keeps it enabled in
 * accessibility settings; [current] lets the engine reach it. All decisions are made by the pure
 * classes (planner, cursor, remote mouse); this class only talks to Android.
 */
class HubAccessibilityService : AccessibilityService() {

    lateinit var planner: GesturePlanner
        private set
    lateinit var cursor: CursorModel
        private set
    private lateinit var overlay: CursorOverlay
    private val remoteMouse = RemoteMouse()
    private var foregroundPackage: String? = null

    override fun onServiceConnected() {
        val bounds = if (Build.VERSION.SDK_INT >= 30) {
            getSystemService(android.view.WindowManager::class.java).maximumWindowMetrics.bounds.let { it.width() to it.height() }
        } else {
            resources.displayMetrics.let { it.widthPixels to it.heightPixels }
        }
        planner = GesturePlanner(bounds.first, bounds.second)
        cursor = CursorModel(bounds.first, bounds.second)
        overlay = CursorOverlay(this)
        _current.value = this
        Log.i(TAG, "connected, screen ${bounds.first}x${bounds.second}")
    }

    override fun onUnbind(intent: Intent?): Boolean {
        _current.value = null
        overlay.hide()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        _current.value = null
        super.onDestroy()
    }

    override fun onInterrupt() = Unit

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> onWindowChanged(event.packageName?.toString())
            AccessibilityEvent.TYPE_VIEW_FOCUSED, AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED -> publishFocus(event.source)
        }
    }

    private fun onWindowChanged(pkg: String?) {
        if (pkg == null || pkg == foregroundPackage || pkg == "com.android.systemui") return
        foregroundPackage = pkg
        _focusedField.value = null
        val prefs = prefs.value
        if (prefs.autoMouseForPhoneApps) setCursorVisible(isPhoneApp(pkg))
    }

    private fun publishFocus(node: AccessibilityNodeInfo?) {
        val n = node ?: return
        _focusedField.value = if (n.isEditable && n.isFocused) {
            FocusedField(n.text?.toString().orEmpty(), n.hintText?.toString(), n.isPassword)
        } else {
            rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }?.let {
                FocusedField(it.text?.toString().orEmpty(), it.hintText?.toString(), it.isPassword)
            }
        }
    }

    /** A phone app: launchable, but without a TV (leanback) entry. Our own app counts too (launcher). */
    private fun isPhoneApp(pkg: String): Boolean {
        if (pkg == packageName) return true
        val pm = packageManager
        val leanback = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER).setPackage(pkg)
        if (pm.queryIntentActivities(leanback, 0).isNotEmpty()) return false
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(pkg)
        return pm.queryIntentActivities(launcher, 0).isNotEmpty()
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val prefs = prefs.value
        if (event.keyCode == KeyEvent.KEYCODE_HOME && prefs.launcherTakesHome && prefs.homeComponent != null) {
            if (event.action == KeyEvent.ACTION_UP) openHome(prefs.homeComponent)
            return true
        }
        val intercepting = prefs.remoteMouseLongPress && foregroundPackage?.let(::isPhoneApp) == true
        val decision = remoteMouse.onKey(event.keyCode, event.action == KeyEvent.ACTION_DOWN, event.eventTime, intercepting, cursor::dpadStep)
        decision.effects.forEach { effect ->
            when (effect) {
                is RemoteMouse.Effect.Move -> moveCursor(effect.dx, effect.dy)
                RemoteMouse.Effect.Click -> dispatch(planner.let { Stroke(listOf(cursor.x to cursor.y), GesturePlanner.TAP_MS) }) {}
                is RemoteMouse.Effect.SetVisible -> setCursorVisible(effect.visible)
                RemoteMouse.Effect.ReplayCenter -> if (Build.VERSION.SDK_INT >= 33) performGlobalAction(GLOBAL_ACTION_DPAD_CENTER)
            }
        }
        return decision.consume
    }

    private fun openHome(component: String) {
        val cn = ComponentName.unflattenFromString(component) ?: return
        runCatching { startActivity(Intent(Intent.ACTION_MAIN).setComponent(cn).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)) }
    }

    // ---- used by the engine ----

    fun setCursorVisible(visible: Boolean) {
        remoteMouse.setVisible(visible)
        if (visible) overlay.show(cursor.x, cursor.y) else overlay.hide()
    }

    val cursorVisible get() = overlay.isShown

    /** Moves the pointer; motion past an edge scrolls the content instead. */
    fun moveCursor(dx: Float, dy: Float) {
        if (!overlay.isShown) setCursorVisible(true)
        val move = cursor.moveBy(dx, dy)
        overlay.moveTo(cursor.x, cursor.y)
        if (move.overflowX != 0f || move.overflowY != 0f) {
            planner.scroll(cursor.x to cursor.y, move.overflowX * 6, move.overflowY * 6)?.let { dispatch(it) {} }
        }
    }

    suspend fun perform(stroke: Stroke): Boolean = suspendCancellableCoroutine { cont ->
        dispatch(stroke) { ok -> if (cont.isActive) cont.resume(ok) }
    }

    private fun dispatch(stroke: Stroke, done: (Boolean) -> Unit) {
        val path = Path()
        stroke.points.forEachIndexed { i, (x, y) -> if (i == 0) path.moveTo(x, y) else path.lineTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, stroke.durationMillis.coerceAtLeast(1)))
            .build()
        val accepted = dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(g: GestureDescription?) = done(true)
            override fun onCancelled(g: GestureDescription?) = done(false)
        }, null)
        if (!accepted) done(false)
    }

    fun focusedEditable(): AccessibilityNodeInfo? =
        rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }

    fun setText(node: AccessibilityNodeInfo, text: String): Boolean =
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        })

    fun pressEnter(node: AccessibilityNodeInfo): Boolean =
        if (Build.VERSION.SDK_INT >= 30) node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id) else false

    companion object {
        private const val TAG = "HubAccessibility"
        private val _current = MutableStateFlow<HubAccessibilityService?>(null)
        val current: StateFlow<HubAccessibilityService?> = _current

        private val _focusedField = MutableStateFlow<FocusedField?>(null)
        val focusedField: StateFlow<FocusedField?> = _focusedField

        val prefs = MutableStateFlow(InputPrefs())
    }
}
