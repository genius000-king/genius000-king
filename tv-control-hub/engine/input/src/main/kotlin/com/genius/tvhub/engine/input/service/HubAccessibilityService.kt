package com.genius.tvhub.engine.input.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
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
import com.genius.tvhub.engine.input.keys.Box
import com.genius.tvhub.engine.input.keys.SpatialNavigator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * The one Android component input needs. It lives while the user keeps it enabled in
 * accessibility settings; [current] lets the engine reach it. Decisions are made by the pure
 * classes (planner, cursor, remote mouse, spatial navigator); this class only talks to Android.
 *
 * Because the system binds it at boot and whenever another app comes forward, it is also what
 * keeps TV Hub the home screen ("Replace Google TV home") and opens it when the TV starts.
 */
class HubAccessibilityService : AccessibilityService() {

    lateinit var planner: GesturePlanner
        private set
    lateinit var cursor: CursorModel
        private set
    private lateinit var overlay: CursorOverlay
    private val remoteMouse = RemoteMouse()
    private var foregroundPackage: String? = null
    private val phoneAppCache = HashMap<String, Boolean>()
    private val otherHomes by lazy { homePackages() }

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
        Log.i(TAG, "connected, screen ${bounds.first}x${bounds.second}, sdk ${Build.VERSION.SDK_INT}")
        // Bound right after boot: open TV Hub, as if someone had pressed it. Accessibility-bound
        // apps may start activities from the background, unlike a boot receiver on newer Android.
        val prefs = prefs.value
        if (prefs.openOnBoot && SystemClock.elapsedRealtime() < BOOT_WINDOW_MILLIS) prefs.homeComponent?.let(::openHome)
        // Most boxes never reboot: "turning the TV on" wakes them from standby. Treat it the same.
        registerReceiver(screenOn, IntentFilter(Intent.ACTION_SCREEN_ON))
    }

    private val screenOn = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val prefs = prefs.value
            if (prefs.openOnBoot || prefs.launcherTakesHome) prefs.homeComponent?.let(::openHome)
        }
    }

    override fun onUnbind(intent: Intent?): Boolean {
        runCatching { unregisterReceiver(screenOn) }
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
        // Another home screen came forward (Home key, boot, an app closed): put TV Hub back.
        if (prefs.launcherTakesHome && pkg in otherHomes) prefs.homeComponent?.let(::openHome)
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

    /** A phone app: launchable, but without a TV (leanback) entry. Cached: it is asked on key presses. */
    private fun isPhoneApp(pkg: String): Boolean = phoneAppCache.getOrPut(pkg) {
        if (pkg == packageName) return@getOrPut false
        val pm = packageManager
        val leanback = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER).setPackage(pkg)
        if (pm.queryIntentActivities(leanback, 0).isNotEmpty()) return@getOrPut false
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(pkg)
        pm.queryIntentActivities(launcher, 0).isNotEmpty()
    }

    private fun homePackages(): Set<String> =
        packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
            .map { it.activityInfo.packageName }.filter { it != packageName && it != "com.android.settings" }.toSet()

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
                RemoteMouse.Effect.Click -> dispatch(Stroke(listOf(cursor.x to cursor.y), GesturePlanner.TAP_MS)) {}
                is RemoteMouse.Effect.SetVisible -> setCursorVisible(effect.visible)
                RemoteMouse.Effect.ReplayBack -> performGlobalAction(GLOBAL_ACTION_BACK)
            }
        }
        return decision.consume
    }

    private fun openHome(component: String) {
        val cn = ComponentName.unflattenFromString(component) ?: return
        runCatching { startActivity(Intent(Intent.ACTION_MAIN).setComponent(cn).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)) }
            .onFailure { Log.w(TAG, "could not open home", it) }
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

    // ---- D-pad without Android 13's global actions ----

    private fun focused(): AccessibilityNodeInfo? {
        val root = rootInActiveWindow ?: return null
        return root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: root.findFocus(AccessibilityNodeInfo.FOCUS_ACCESSIBILITY)
    }

    /**
     * Moves focus like a D-pad press: the app's own focus search first, then geometry over every
     * focusable element on screen. With nothing focused yet, focuses the first element.
     */
    fun moveFocus(direction: Int): Boolean {
        val root = rootInActiveWindow ?: return false
        val current = focused()
        val candidates = mutableListOf<AccessibilityNodeInfo>()
        collectFocusable(root, candidates)
        if (current == null) return candidates.firstOrNull()?.let(::focus) ?: false
        current.focusSearch(direction)?.takeIf { it.isVisibleToUser }?.let { if (focus(it)) return true }
        val from = boxOf(current)
        val target = SpatialNavigator.next(from, candidates.map(::boxOf), direction) ?: return false
        return focus(candidates[target])
    }

    /** OK without global actions: click the focused element, or its nearest clickable parent. */
    fun clickFocused(): Boolean {
        var node = focused() ?: return false
        repeat(6) {
            if (node.isClickable && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
            node = node.parent ?: return false
        }
        return false
    }

    private fun focus(node: AccessibilityNodeInfo): Boolean =
        node.performAction(AccessibilityNodeInfo.ACTION_FOCUS) || node.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS)

    private fun collectFocusable(node: AccessibilityNodeInfo, out: MutableList<AccessibilityNodeInfo>, depth: Int = 0) {
        if (depth > 40 || out.size > 400) return
        if (node.isVisibleToUser && (node.isFocusable || node.isClickable) && node.isEnabled) out += node
        for (i in 0 until node.childCount) node.getChild(i)?.let { collectFocusable(it, out, depth + 1) }
    }

    private fun boxOf(n: AccessibilityNodeInfo): Box = Rect().also(n::getBoundsInScreen).let { Box(it.left, it.top, it.right, it.bottom) }

    // ---- text ----

    fun focusedEditable(): AccessibilityNodeInfo? =
        rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }

    /** Sets the field's text; fields that refuse it (custom editors) get it pasted instead. */
    fun setText(node: AccessibilityNodeInfo, text: String): Boolean {
        val set = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        })
        if (set) return true
        return runCatching {
            getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("tvhub", text))
            node.performAction(AccessibilityNodeInfo.ACTION_PASTE)
        }.getOrDefault(false)
    }

    fun pressEnter(node: AccessibilityNodeInfo): Boolean =
        if (Build.VERSION.SDK_INT >= 30) node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id) else false

    companion object {
        private const val TAG = "HubAccessibility"
        private const val BOOT_WINDOW_MILLIS = 4 * 60_000L
        private val _current = MutableStateFlow<HubAccessibilityService?>(null)
        val current: StateFlow<HubAccessibilityService?> = _current

        private val _focusedField = MutableStateFlow<FocusedField?>(null)
        val focusedField: StateFlow<FocusedField?> = _focusedField

        val prefs = MutableStateFlow(InputPrefs())
    }
}
