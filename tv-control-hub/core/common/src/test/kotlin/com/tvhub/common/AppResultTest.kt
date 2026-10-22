package com.tvhub.common

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AppResultTest {

    @Test
    fun `map transforms a success value`() {
        val result = AppResult.Success(2).map { it * 10 }

        assertEquals(AppResult.Success(20), result)
    }

    @Test
    fun `map keeps the original error without calling the transform`() {
        val error = AppError(code = "device.offline", message = "no route to host")
        var called = false

        val result = AppResult.Failure(error).map {
            called = true
            it
        }

        assertEquals(AppResult.Failure(error), result)
        assertEquals(false, called)
    }

    @Test
    fun `flatMap chains a success into another result`() {
        val result = AppResult.Success(2).flatMap { AppResult.Success(it + 1) }

        assertEquals(AppResult.Success(3), result)
    }

    @Test
    fun `flatMap stops at the first failure`() {
        val error = AppError(code = "a", message = "first")

        val result = AppResult.Failure(error).flatMap { AppResult.Success(it) }

        assertEquals(AppResult.Failure(error), result)
    }

    @Test
    fun `getOrNull returns the value only for success`() {
        assertEquals("ok", AppResult.Success("ok").getOrNull())
        assertNull(AppResult.Failure(AppError("x", "y")).getOrNull())
    }
}
