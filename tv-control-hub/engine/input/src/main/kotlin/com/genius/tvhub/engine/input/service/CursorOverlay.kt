package com.genius.tvhub.engine.input.service

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.View
import android.view.WindowManager

/**
 * The pointer, drawn in an accessibility overlay window (no "draw over apps" permission needed).
 * The window ignores touches, so a tap dispatched at the pointer reaches the app below.
 */
internal class CursorOverlay(private val context: Context) {
    private val wm = context.getSystemService(WindowManager::class.java)
    private val sizePx = (34 * context.resources.displayMetrics.density).toInt()
    private var view: View? = null
    private val params = WindowManager.LayoutParams(
        sizePx, sizePx,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT,
    // LEFT, not START: in an Arabic (RTL) layout START is the right edge, which drew the pointer
    // mirrored from where its taps land.
    ).apply { gravity = Gravity.TOP or Gravity.LEFT }

    val isShown get() = view != null

    fun show(x: Float, y: Float) {
        if (view == null) {
            view = PointerView(context).also { runCatching { wm.addView(it, params) } }
        }
        moveTo(x, y)
    }

    fun moveTo(x: Float, y: Float) {
        val v = view ?: return
        params.x = x.toInt(); params.y = y.toInt()
        runCatching { wm.updateViewLayout(v, params) }
    }

    fun hide() {
        view?.let { runCatching { wm.removeView(it) } }
        view = null
    }

    /** Cream arrow with a charcoal edge: readable on any picture. The tip is the view's origin. */
    private class PointerView(context: Context) : View(context) {
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(0xF1, 0xF0, 0xEC) }
        private val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(220, 0x0A, 0x0A, 0x0A); style = Paint.Style.STROKE
            strokeWidth = 2.5f * context.resources.displayMetrics.density; strokeJoin = Paint.Join.ROUND
        }
        private val path = Path()

        override fun onDraw(canvas: Canvas) {
            val u = width / 24f
            path.reset()
            path.moveTo(2 * u, 1 * u); path.lineTo(18 * u, 12 * u); path.lineTo(11 * u, 13 * u)
            path.lineTo(15 * u, 21 * u); path.lineTo(12 * u, 22.5f * u); path.lineTo(8.5f * u, 14.5f * u)
            path.lineTo(2 * u, 19 * u); path.close()
            canvas.drawPath(path, edge)
            canvas.drawPath(path, fill)
        }
    }
}
