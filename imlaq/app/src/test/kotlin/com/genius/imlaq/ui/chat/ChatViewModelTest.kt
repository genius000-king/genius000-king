package com.genius.imlaq.ui.chat

import com.genius.imlaq.engine.EngineState
import com.genius.imlaq.engine.TextEngine
import com.genius.imlaq.engine.TextEvent
import com.genius.imlaq.engine.TextRequest
import com.genius.imlaq.models.LocalModel
import com.genius.imlaq.session.ModelSession
import com.genius.imlaq.session.SessionModel
import com.genius.imlaq.session.SessionState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {

    /** Replies with whatever the test pushes into [events]; records every request. */
    private class FakeEngine : TextEngine {
        override val id = "fake"
        override val state: StateFlow<EngineState> = MutableStateFlow(EngineState.Ready())
        val requests = mutableListOf<TextRequest>()
        val events = Channel<TextEvent>(Channel.UNLIMITED)
        var cancelled = 0
        override suspend fun load(model: File) = Unit
        override suspend fun unload() = Unit
        override fun cancel() { cancelled++ }
        override fun generate(request: TextRequest): Flow<TextEvent> = flow {
            requests += request
            for (e in events) {
                emit(e)
                if (e is TextEvent.Finished || e is TextEvent.Failed) break
            }
        }
    }

    private class FakeSession(override val engine: FakeEngine) : ModelSession {
        val qwen = SessionModel("Qwen3 30B", File("/m/qwen.gguf"))
        override val state = MutableStateFlow<SessionState>(SessionState.Ready(qwen))
        override fun load(model: LocalModel, name: String) = Unit
        override fun unload() { state.value = SessionState.Idle }
    }

    private val engine = FakeEngine()
    private val session = FakeSession(engine)
    private lateinit var vm: ChatViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        vm = ChatViewModel(session)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun aReplyStreamsInAndEndsWithItsSpeed() {
        vm.send("  ليش السماء زرقاء؟ ")
        val thinking = vm.state.value.messages.last()
        assertTrue(thinking.thinking)
        assertTrue(vm.state.value.generating)

        engine.events.trySend(TextEvent.Started)
        engine.events.trySend(TextEvent.Delta("لأن ", "", replace = false))
        engine.events.trySend(TextEvent.Delta("الضوء", "", replace = false))
        assertEquals("لأن الضوء", vm.state.value.messages.last().text)
        assertFalse(vm.state.value.messages.last().thinking)

        engine.events.trySend(TextEvent.Finished("لأن الضوء الأزرق يتشتت أكثر.", "", 9, 2.4, 1.0, cancelled = false))
        val (user, reply) = vm.state.value.messages
        assertEquals("ليش السماء زرقاء؟", user.text)
        assertEquals("لأن الضوء الأزرق يتشتت أكثر.", reply.text)
        assertEquals(2.4, reply.tokensPerSecond!!, 0.0)
        assertFalse(vm.state.value.generating)
    }

    @Test
    fun onlyTheFirstTurnOfAConversationClearsTheEnginesMemory() {
        vm.send("أول")
        engine.events.trySend(TextEvent.Finished("1", "", 1, 1.0, 0.0, false))
        vm.send("ثاني")
        engine.events.trySend(TextEvent.Finished("2", "", 1, 1.0, 0.0, false))
        assertEquals(listOf(true, false), engine.requests.map { it.newConversation })

        vm.newChat()
        assertTrue(vm.state.value.messages.isEmpty())
        vm.send("جديد")
        assertTrue(engine.requests.last().newConversation)
    }

    @Test
    fun aReplaceDeltaReplacesTheText() {
        vm.send("س")
        engine.events.trySend(TextEvent.Delta("مسودة", "", replace = false))
        engine.events.trySend(TextEvent.Delta("نهائي", "", replace = true))
        assertEquals("نهائي", vm.state.value.messages.last().text)
    }

    @Test
    fun aFailedTurnShowsWhyAndFreesTheInput() {
        vm.send("س")
        engine.events.trySend(TextEvent.Failed("engine exited (3): out of memory", fatal = true))
        val reply = vm.state.value.messages.last()
        assertEquals("engine exited (3): out of memory", reply.error)
        assertFalse(reply.thinking)
        assertFalse(vm.state.value.generating)
    }

    @Test
    fun nothingIsSentWithoutAModelOrWhileAnswering() {
        vm.send("   ")
        assertTrue(engine.requests.isEmpty())

        vm.send("أول")
        vm.send("ثاني أثناء الرد")
        assertEquals(1, engine.requests.size)

        session.state.value = SessionState.Idle
        engine.events.trySend(TextEvent.Finished("1", "", 1, 1.0, 0.0, false))
        vm.send("بدون نموذج")
        assertEquals(1, engine.requests.size)
    }

    @Test
    fun loadingAnotherModelStartsAFreshConversation() {
        vm.send("أول")
        engine.events.trySend(TextEvent.Finished("1", "", 1, 1.0, 0.0, false))
        session.state.value = SessionState.Ready(SessionModel("Gemma 4 26B", File("/m/gemma.gguf")))
        assertTrue(vm.state.value.messages.isEmpty())
        vm.send("مرحبا")
        assertTrue(engine.requests.last().newConversation)
    }

    @Test
    fun stopAsksTheEngineToCancel() {
        vm.send("طويل")
        vm.stop()
        assertEquals(1, engine.cancelled)
    }
}
