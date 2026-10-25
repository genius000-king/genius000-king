package com.genius.tvhub.runtime.host

import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.data.TrustStore
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.PeerInfo
import com.genius.tvhub.core.model.TrustedDevice
import com.genius.tvhub.core.security.Gatekeeper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.ConcurrentHashMap

/** A phone asking to pair, shown on the TV until someone answers. */
data class PairingRequest(val peer: PeerInfo, val code: String)

/**
 * The TV's trust decisions. Known phones get their stored grants; a new phone waits for the
 * person at the TV (one press on OK), at most [answerTimeoutMillis]. One request at a time, so
 * a misbehaving device cannot stack prompts.
 */
class HostGatekeeper(
    private val trust: TrustStore,
    private val settings: SettingsStore,
    private val answerTimeoutMillis: Long = 90_000,
) : Gatekeeper {
    private val known = ConcurrentHashMap<String, TrustedDevice>()
    private val _request = MutableStateFlow<PairingRequest?>(null)
    val request: StateFlow<PairingRequest?> = _request
    private var answer: CompletableDeferred<Boolean>? = null
    private val oneAtATime = Mutex()

    /** Keeps the synchronous lookup in step with the database. */
    fun update(devices: List<TrustedDevice>) {
        known.keys.retainAll(devices.map { it.id }.toSet())
        devices.forEach { known[it.id] = it }
    }

    fun grantsOf(id: String): Grants = known[id]?.grants ?: Grants.NONE

    override fun check(peer: PeerInfo, identityKey: ByteArray): Gatekeeper.Verdict {
        val d = known[peer.id] ?: return Gatekeeper.Verdict.Unknown
        return if (d.publicKey.contentEquals(identityKey)) Gatekeeper.Verdict.Trusted(d.grants) else Gatekeeper.Verdict.Blocked("identity changed")
    }

    override suspend fun requestApproval(peer: PeerInfo, identityKey: ByteArray, sas: String): Gatekeeper.Verdict {
        if (!oneAtATime.tryLock()) return Gatekeeper.Verdict.Blocked("the TV is answering another phone")
        try {
            val allowed = if (settings.current().autoApproveNew) true else {
                val deferred = CompletableDeferred<Boolean>()
                answer = deferred
                _request.value = PairingRequest(peer, sas)
                withTimeoutOrNull(answerTimeoutMillis) { deferred.await() } ?: false
            }
            if (!allowed) return Gatekeeper.Verdict.Blocked("refused on the TV")
            trust.trust(peer.id, peer.name, peer.model, identityKey, Grants.DEFAULT)
            known[peer.id] = TrustedDevice(peer.id, peer.name, peer.model, identityKey, Grants.DEFAULT, System.currentTimeMillis(), System.currentTimeMillis())
            return Gatekeeper.Verdict.Trusted(Grants.DEFAULT)
        } finally {
            _request.value = null
            answer = null
            oneAtATime.unlock()
        }
    }

    fun approve() { answer?.complete(true) }
    fun deny() { answer?.complete(false) }
}
