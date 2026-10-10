package com.genius.imlaq.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.imlaq.engine.TextEvent
import com.genius.imlaq.engine.TextRequest
import com.genius.imlaq.session.ModelSession
import com.genius.imlaq.session.SessionState
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChatMessage(
    val id: Long,
    val fromUser: Boolean,
    val text: String,
    /** The model is still thinking (reasoning) and has written no answer yet. */
    val thinking: Boolean = false,
    val tokensPerSecond: Double? = null,
    val error: String? = null,
)

data class ChatUiState(
    val session: SessionState = SessionState.Idle,
    val messages: List<ChatMessage> = emptyList(),
    val generating: Boolean = false,
)

class ChatViewModel(private val session: ModelSession) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = _state

    private var nextId = 1L
    private var turn: Job? = null
    /** The engine's conversation is empty: the next turn must say so (clear its KV cache). */
    private var freshConversation = true

    init {
        viewModelScope.launch {
            var lastFile: java.io.File? = null
            session.state.collect { s ->
                val file = (s as? SessionState.Ready)?.model?.file
                if (file != null && file != lastFile) {
                    // A different model is a different conversation.
                    turn?.cancel()
                    freshConversation = true
                    _state.update { it.copy(messages = emptyList(), generating = false) }
                }
                if (file != null) lastFile = file
                _state.update { it.copy(session = s) }
            }
        }
    }

    fun send(text: String) {
        val prompt = text.trim()
        if (prompt.isEmpty() || _state.value.generating || session.state.value !is SessionState.Ready) return
        val user = ChatMessage(nextId++, fromUser = true, text = prompt)
        val reply = ChatMessage(nextId++, fromUser = false, text = "", thinking = true)
        _state.update { it.copy(messages = it.messages + user + reply, generating = true) }
        val newConversation = freshConversation
        freshConversation = false

        turn = viewModelScope.launch {
            var answer = ""
            try {
                session.engine.generate(TextRequest(prompt, maxTokens = 1024, think = false, newConversation = newConversation))
                    .collect { e ->
                        when (e) {
                            is TextEvent.Delta -> {
                                answer = if (e.replace) e.text else answer + e.text
                                edit(reply.id) { it.copy(text = answer, thinking = answer.isEmpty()) }
                            }
                            is TextEvent.Finished -> edit(reply.id) {
                                it.copy(text = e.text.ifEmpty { answer }, thinking = false, tokensPerSecond = e.tokensPerSecond.takeIf { t -> t > 0 })
                            }
                            is TextEvent.Failed -> edit(reply.id) { it.copy(thinking = false, error = e.message) }
                            else -> Unit
                        }
                    }
            } finally {
                edit(reply.id) { it.copy(thinking = false) }
                _state.update { it.copy(generating = false) }
            }
        }
    }

    fun stop() = session.engine.cancel()

    fun newChat() {
        if (_state.value.generating) session.engine.cancel()
        turn?.cancel()
        freshConversation = true
        _state.update { it.copy(messages = emptyList(), generating = false) }
    }

    private fun edit(id: Long, change: (ChatMessage) -> ChatMessage) =
        _state.update { s -> s.copy(messages = s.messages.map { if (it.id == id) change(it) else it }) }
}
