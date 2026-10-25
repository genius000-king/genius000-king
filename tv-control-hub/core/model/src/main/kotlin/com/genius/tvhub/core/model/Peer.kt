package com.genius.tvhub.core.model

import kotlinx.serialization.Serializable

enum class DeviceRole { PHONE, TV }

/** Who is on the other end. [id] is the hex fingerprint of the device's identity key. */
@Serializable
data class PeerInfo(
    val id: String,
    val name: String,
    val model: String,
    val role: DeviceRole,
    val appVersion: String,
)

/**
 * What a paired phone may do on the TV. Stored as a bitmask on the TV, checked on every call.
 * Shell and services run commands, so they are off until the TV owner turns them on.
 */
enum class Grant(val bit: Int) {
    SCREEN(1 shl 0),
    INPUT(1 shl 1),
    SYSTEM_INFO(1 shl 2),
    FILES_READ(1 shl 3),
    FILES_WRITE(1 shl 4),
    APPS(1 shl 5),
    SHELL(1 shl 6),
    SERVICES(1 shl 7),
}

@Serializable
@JvmInline
value class Grants(val bits: Int) {
    operator fun contains(grant: Grant) = bits and grant.bit != 0
    operator fun plus(grant: Grant) = Grants(bits or grant.bit)
    operator fun minus(grant: Grant) = Grants(bits and grant.bit.inv())
    fun toSet(): Set<Grant> = Grant.entries.filterTo(LinkedHashSet()) { it in this }

    companion object {
        val NONE = Grants(0)
        val ALL = of(*Grant.entries.toTypedArray())
        /** Granted on pairing: everything except running commands. */
        val DEFAULT = ALL - Grant.SHELL - Grant.SERVICES
        fun of(vararg grants: Grant) = Grants(grants.fold(0) { acc, g -> acc or g.bit })
    }
}
