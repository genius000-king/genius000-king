package com.tvhub.common

/**
 * Outcome of an operation whose failure is expected and must be handled,
 * such as a rejected pairing or an unreachable device.
 */
sealed interface AppResult<out T> {
    data class Success<out T>(val value: T) : AppResult<T>

    data class Failure(val error: AppError) : AppResult<Nothing>
}

/**
 * A failure with a stable [code] that tests and UI can branch on.
 * [message] is for diagnostics, not for direct display to users.
 */
data class AppError(
    val code: String,
    val message: String,
    val cause: Throwable? = null,
)

inline fun <T, R> AppResult<T>.map(transform: (T) -> R): AppResult<R> =
    when (this) {
        is AppResult.Success -> AppResult.Success(transform(value))
        is AppResult.Failure -> this
    }

inline fun <T, R> AppResult<T>.flatMap(transform: (T) -> AppResult<R>): AppResult<R> =
    when (this) {
        is AppResult.Success -> transform(value)
        is AppResult.Failure -> this
    }

fun <T> AppResult<T>.getOrNull(): T? =
    (this as? AppResult.Success)?.value
