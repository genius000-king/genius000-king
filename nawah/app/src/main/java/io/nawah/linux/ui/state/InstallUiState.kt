package io.nawah.linux.ui.state

import androidx.compose.runtime.Immutable
import io.nawah.linux.core.provision.InstallProgress
import io.nawah.linux.core.provision.InstallStep

/**
 * A view-side projection of [InstallStep].
 *
 * `InstallStep` is a sealed interface declared in `:core`, so its members
 * cannot be instantiated from this module — a `@Preview` could not build one.
 * The projection keeps exactly the two properties the contract guarantees
 * (`order`, `label`); [toUi] is the only bridge and it touches nothing else.
 */
@Immutable
data class InstallStepUi(val order: Int, val step: InstallStep)

fun InstallStep.toUi(): InstallStepUi = InstallStepUi(order = order, step = this)

enum class StepStatus { DONE, CURRENT, PENDING, FAILED }

@Immutable
data class InstallFailure(
    val step: InstallStep,
    val message: String,
    /** The full log, as handed over by `InstallProgress.Failed.log`. */
    val log: String,
)

@Immutable
data class InstallUiState(
    val machineName: String = "",
    /** Every step of the install, in order. Shown as a checklist from the start. */
    val steps: List<InstallStepUi> = emptyList(),
    /** `order` of the step currently running; null before the first progress event. */
    val currentOrder: Int? = null,
    /** Null means "working, but no measurable fraction" — show it indeterminate. */
    val fraction: Float? = null,
    val log: List<String> = emptyList(),
    val failure: InstallFailure? = null,
    val done: Boolean = false,
    val cancelling: Boolean = false,
) {
    val failed: Boolean get() = failure != null
    val running: Boolean get() = !done && failure == null

    fun statusOf(step: InstallStepUi): StepStatus {
        val current = currentOrder
        return when {
            done -> StepStatus.DONE
            failure != null && current != null && step.order == current -> StepStatus.FAILED
            current == null -> StepStatus.PENDING
            step.order < current -> StepStatus.DONE
            step.order == current -> StepStatus.CURRENT
            else -> StepStatus.PENDING
        }
    }

    val currentStep: InstallStepUi?
        get() = steps.firstOrNull { it.order == currentOrder }

    /** What "Copy log" puts on the clipboard. */
    val logText: String
        get() = failure?.log?.takeIf { it.isNotBlank() } ?: log.joinToString("\n")

    companion object {
        /** The pane is a tail, not an archive; the full log lives in install.log. */
        const val MAX_LOG_LINES: Int = 600
    }
}

/**
 * Folds one progress event into the state. Kept here rather than in a
 * ViewModel so it is a pure function and can be unit-tested without Android.
 */
fun InstallUiState.reduce(progress: InstallProgress): InstallUiState = when (progress) {
    is InstallProgress.Running -> copy(
        currentOrder = progress.step.order,
        fraction = progress.fraction,
        log = progress.line?.let { appendLine(it) } ?: log,
        failure = null,
        done = false,
    )

    is InstallProgress.Done -> copy(
        machineName = progress.machine.name,
        currentOrder = steps.maxOfOrNull { it.order } ?: currentOrder,
        fraction = 1f,
        done = true,
        failure = null,
        cancelling = false,
    )

    is InstallProgress.Failed -> copy(
        currentOrder = progress.step.order,
        failure = InstallFailure(
            step = progress.step,
            message = progress.message,
            log = progress.log,
        ),
        done = false,
        cancelling = false,
    )
}

private fun InstallUiState.appendLine(line: String): List<String> {
    val next = log + line
    return if (next.size <= InstallUiState.MAX_LOG_LINES) next
    else next.subList(next.size - InstallUiState.MAX_LOG_LINES, next.size)
}
