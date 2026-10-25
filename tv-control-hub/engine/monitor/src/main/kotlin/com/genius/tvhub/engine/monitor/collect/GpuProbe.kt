package com.genius.tvhub.engine.monitor.collect

import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.GLES20

/** GPU name and GL version from a throwaway 1×1 EGL context. Usage figures have no Android API. */
object GpuProbe {
    data class Gpu(val renderer: String, val vendor: String, val version: String)

    fun probe(): Gpu? = runCatching {
        val display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        val v = IntArray(2)
        EGL14.eglInitialize(display, v, 0, v, 1)
        val configs = arrayOfNulls<EGLConfig>(1); val n = IntArray(1)
        EGL14.eglChooseConfig(display, intArrayOf(EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT, EGL14.EGL_SURFACE_TYPE, EGL14.EGL_PBUFFER_BIT, EGL14.EGL_NONE), 0, configs, 0, 1, n, 0)
        val ctx = EGL14.eglCreateContext(display, configs[0], EGL14.EGL_NO_CONTEXT, intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0)
        val surface = EGL14.eglCreatePbufferSurface(display, configs[0], intArrayOf(EGL14.EGL_WIDTH, 1, EGL14.EGL_HEIGHT, 1, EGL14.EGL_NONE), 0)
        EGL14.eglMakeCurrent(display, surface, surface, ctx)
        val gpu = Gpu(GLES20.glGetString(GLES20.GL_RENDERER).orEmpty(), GLES20.glGetString(GLES20.GL_VENDOR).orEmpty(), GLES20.glGetString(GLES20.GL_VERSION).orEmpty())
        EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
        EGL14.eglDestroySurface(display, surface); EGL14.eglDestroyContext(display, ctx); EGL14.eglTerminate(display)
        gpu.takeIf { it.renderer.isNotBlank() }
    }.getOrNull()
}
