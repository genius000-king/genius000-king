package com.genius.tvhub.core.data

import com.genius.tvhub.core.common.Clock
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.PairedTv
import com.genius.tvhub.core.model.ServiceKind
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.TrustedDevice
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/** TV: who may connect and what they may do. */
@Singleton
class TrustStore @Inject constructor(private val dao: TrustedDeviceDao, private val clock: Clock) {
    val devices: Flow<List<TrustedDevice>> = dao.observe().map { list -> list.map { it.toModel() } }

    suspend fun get(id: String): TrustedDevice? = dao.get(id)?.toModel()

    suspend fun trust(id: String, name: String, model: String, publicKey: ByteArray, grants: Grants) {
        val now = clock.nowMillis()
        dao.upsert(TrustedDeviceEntity(id, name, model, publicKey, grants.bits, now, now))
    }

    suspend fun setGrants(id: String, grants: Grants) = dao.setGrants(id, grants.bits)
    suspend fun seen(id: String) = dao.touch(id, clock.nowMillis())
    suspend fun revoke(id: String) = dao.delete(id)

    private fun TrustedDeviceEntity.toModel() = TrustedDevice(id, name, model, publicKey, Grants(grants), pairedAt, lastSeenAt)
}

/** Phone: TVs it has paired with, most recent first. */
@Singleton
class PairedTvStore @Inject constructor(private val dao: PairedTvDao, private val clock: Clock) {
    val tvs: Flow<List<PairedTv>> = dao.observe().map { list -> list.map { it.toModel() } }

    suspend fun get(id: String): PairedTv? = dao.get(id)?.toModel()

    suspend fun remember(id: String, name: String, publicKey: ByteArray, host: String, port: Int) {
        val now = clock.nowMillis()
        val existing = dao.get(id)
        dao.upsert(PairedTvEntity(id, name, publicKey, host, port, existing?.pairedAt ?: now, now))
    }

    suspend fun seenAt(id: String, host: String, port: Int) = dao.seenAt(id, host, port, clock.nowMillis())
    suspend fun forget(id: String) = dao.delete(id)

    private fun PairedTvEntity.toModel() = PairedTv(id, name, publicKey, host, port, pairedAt, lastConnectedAt)
}

/** TV: Termux services the user defined. */
@Singleton
class ServiceStore @Inject constructor(private val dao: ServiceDao) {
    val services: Flow<List<ServiceSpec>> = dao.observe().map { list -> list.map { it.toModel() } }
    suspend fun all(): List<ServiceSpec> = dao.all().map { it.toModel() }
    suspend fun save(spec: ServiceSpec) = dao.upsert(ServiceEntity(spec.id, spec.name, spec.kind.name, spec.workdir, spec.command, spec.autoStart))
    suspend fun remove(id: String) = dao.delete(id)

    private fun ServiceEntity.toModel() = ServiceSpec(id, name, runCatching { ServiceKind.valueOf(kind) }.getOrDefault(ServiceKind.CUSTOM), workdir, command, autoStart)
}
