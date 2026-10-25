package com.genius.tvhub.core.transport

import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.core.protocol.Domain
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.Frame
import com.genius.tvhub.core.protocol.ProtocolCodec
import com.genius.tvhub.core.protocol.Push
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.core.protocol.Reply
import com.genius.tvhub.core.security.SecureSession
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * The phone's RPC over one secure session: [call] sends a request and waits for its reply;
 * pushes go to [onPush] on the read loop itself, in order, before the next frame is read — so a
 * push followed at once by the socket closing (a revocation) is never lost. [events] mirrors them.
 */
class RpcClient(private val session: SecureSession, private val onPush: suspend (Push) -> Unit = {}) {
    private val ids = AtomicLong(1)
    private val pending = ConcurrentHashMap<Long, CompletableDeferred<Reply>>()
    private val _events = MutableSharedFlow<Push>(extraBufferCapacity = 64)
    val events: SharedFlow<Push> = _events

    suspend fun call(call: Call, timeoutMillis: Long = DEFAULT_TIMEOUT): Reply {
        val id = ids.getAndIncrement()
        val deferred = CompletableDeferred<Reply>()
        pending[id] = deferred
        try {
            session.send(ProtocolCodec.encode(Frame.Request(id, call)))
            val reply = try {
                withTimeout(timeoutMillis) { deferred.await() }
            } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
                throw RemoteException(ErrorCode.TIMEOUT, "no reply in ${timeoutMillis}ms")
            }
            if (reply is Reply.Error) throw RemoteException(reply.code, reply.message)
            return reply
        } finally {
            pending.remove(id)
        }
    }

    /** Fire-and-forget for high-rate input (pointer moves) where a reply would only add traffic. */
    suspend fun send(call: Call) {
        session.send(ProtocolCodec.encode(Frame.Request(0, call)))
    }

    suspend fun run() {
        try {
            while (true) {
                val bytes = session.receive() ?: break
                when (val frame = ProtocolCodec.decode(bytes)) {
                    is Frame.Response -> pending[frame.id]?.complete(frame.reply)
                    is Frame.Event -> { onPush(frame.push); _events.emit(frame.push) }
                    is Frame.Request -> Log.w(TAG, "ignoring request from TV")
                }
            }
        } finally {
            val closed = RemoteException(ErrorCode.UNAVAILABLE, "connection closed")
            pending.values.forEach { it.completeExceptionally(closed) }
        }
    }

    companion object {
        private const val TAG = "RpcClient"
        const val DEFAULT_TIMEOUT = 10_000L
    }
}

/** Answers one call. Throw [RemoteException] for a typed error. */
fun interface CallHandler {
    suspend fun handle(call: Call): Reply
}

/**
 * The TV's RPC over one secure session. Input and session calls are answered in order on the
 * read loop (a tap must not overtake the key before it); everything else runs concurrently so a
 * 30-second command never freezes the remote.
 */
class RpcServer(private val session: SecureSession, private val scope: CoroutineScope) {

    suspend fun push(push: Push) = session.send(ProtocolCodec.encode(Frame.Event(push)))

    suspend fun run(handler: CallHandler) {
        while (true) {
            val bytes = session.receive() ?: break
            val frame = ProtocolCodec.decode(bytes) as? Frame.Request ?: continue
            if (frame.call.domain == Domain.INPUT || frame.call.domain == Domain.SESSION) {
                answer(frame, handler)
            } else {
                scope.launch { answer(frame, handler) }
            }
        }
    }

    private suspend fun answer(frame: Frame.Request, handler: CallHandler) {
        val reply = try {
            handler.handle(frame.call)
        } catch (e: RemoteException) {
            Reply.Error(e.code, e.message ?: e.code.name)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "call ${frame.call::class.simpleName} failed", e)
            Reply.Error(ErrorCode.FAILED, e.message ?: e::class.simpleName.orEmpty())
        }
        // id 0 is fire-and-forget: errors are logged, not answered.
        if (frame.id != 0L) runCatching { session.send(ProtocolCodec.encode(Frame.Response(frame.id, reply))) }
    }

    companion object { private const val TAG = "RpcServer" }
}
