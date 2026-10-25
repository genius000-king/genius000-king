package com.genius.tvhub.engine.apps.icons

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.util.LruCache
import java.io.ByteArrayOutputStream

/** An icon drawn at a size, with its accent colour (ARGB). */
class LocalIcon(val bitmap: Bitmap, val accent: Int)

/** Draws app icons into bitmaps, remembers recent ones (the TV has 2 GB: the cache is small). */
class IconLoader(private val context: Context) {
    private val cache = object : LruCache<String, LocalIcon>(6 * 1024 * 1024) {
        override fun sizeOf(key: String, value: LocalIcon) = value.bitmap.byteCount
    }

    fun load(packageName: String, sizePx: Int): LocalIcon? {
        val key = "$packageName@$sizePx"
        cache.get(key)?.let { return it }
        val drawable = runCatching { context.packageManager.getApplicationIcon(packageName) }.getOrNull() ?: return null
        val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, sizePx, sizePx)
        drawable.draw(Canvas(bmp))
        val small = Bitmap.createScaledBitmap(bmp, 32, 32, true)
        val pixels = IntArray(32 * 32).also { small.getPixels(it, 0, 32, 0, 0, 32, 32) }
        if (small != bmp) small.recycle()
        return LocalIcon(bmp, AccentExtractor.accent(pixels)).also { cache.put(key, it) }
    }

    fun png(icon: LocalIcon): ByteArray = ByteArrayOutputStream().use { out ->
        icon.bitmap.compress(Bitmap.CompressFormat.PNG, 100, out); out.toByteArray()
    }
}
