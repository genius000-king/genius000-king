package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Test

/**
 * Reproduces the shape of the installer's step 5.
 *
 * `ProotRunner.exec` reads the child's output inside `withContext(IO)` and
 * calls back per line. If the installer's own `emit` is what that callback
 * runs, the emission happens from a *different coroutine* than the flow body —
 * and `flow {}` forbids that outright. It is not a dispatcher question: the
 * flow already runs on IO. It is the Job that differs.
 *
 * This is the first place in the pipeline where any command runs through
 * proot, which is exactly where the install died on a device.
 */
class FlowEmissionContextTest {

    /** The old shape: emit reached from inside a nested withContext. */
    private fun brokenFlow(): Flow<String> = flow {
        emit("direct emission is fine")
        withContext(Dispatchers.IO) {
            // Stands in for ProotRunner.exec's line callback.
            emit("emission from another coroutine")
        }
    }.flowOn(Dispatchers.IO)

    /** What the installer does now: channelFlow allows exactly this. */
    private fun fixedFlow(): Flow<String> = channelFlow {
        send("direct emission is fine")
        withContext(Dispatchers.IO) {
            send("emission from another coroutine")
        }
    }

    @Test
    fun `emitting from a nested coroutine violates the flow invariant`() {
        val error = runCatching { runBlocking { brokenFlow().toList() } }.exceptionOrNull()

        assertThat(error).isInstanceOf(IllegalStateException::class.java)
        assertThat(error).hasMessageThat().contains("Flow invariant is violated")
    }

    @Test
    fun `channelFlow accepts the same emission`() = runBlocking {
        assertThat(fixedFlow().toList()).containsExactly(
            "direct emission is fine",
            "emission from another coroutine",
        ).inOrder()
    }

    /**
     * The pipeline's actual shape, end to end: a runner that reads a child's
     * output on its own dispatcher and calls back per line, with the callback
     * emitting. This is `runGuestChecked` in miniature.
     */
    @Test
    fun `a runner-style callback can emit through the installer's flow`() = runBlocking {
        suspend fun runCommand(onLine: suspend (String) -> Unit): Int =
            withContext(Dispatchers.IO) {
                listOf("Get:1 http://deb.debian.org/debian trixie InRelease", "Reading package lists...")
                    .forEach { onLine(it) }
                0
            }

        val progress = channelFlow {
            send("step started")
            val code = runCommand { line -> send("line: " + line) }
            send("step finished with " + code)
        }.toList()

        assertThat(progress).hasSize(4)
        assertThat(progress.last()).isEqualTo("step finished with 0")
    }
}
