package com.genius.tvhub.core.discovery

/**
 * What a TV announces over mDNS, and how it is parsed back. Pure, so the format is tested
 * without a network.
 *
 * TXT keys: id = identity fingerprint, v = protocol version, n = display name (UTF-8; the
 * mDNS instance name may be truncated or de-duplicated with " (2)").
 */
data class ServiceRecord(val id: String, val name: String, val protocol: Int) {

    fun toTxt(): Map<String, String> = mapOf("id" to id, "v" to protocol.toString(), "n" to name.take(MAX_NAME))

    companion object {
        const val SERVICE_TYPE = "_tvhub._tcp."
        private const val MAX_NAME = 60

        fun fromTxt(txt: Map<String, ByteArray?>, instanceName: String): ServiceRecord? {
            val id = txt["id"]?.decodeToString()?.takeIf { it.matches(Regex("[0-9a-f]{64}")) } ?: return null
            val protocol = txt["v"]?.decodeToString()?.toIntOrNull() ?: return null
            val name = txt["n"]?.decodeToString()?.takeIf { it.isNotBlank() } ?: instanceName
            return ServiceRecord(id, name, protocol)
        }

        /** mDNS instance names: at most 63 bytes, no dots. */
        fun instanceName(name: String): String {
            val clean = name.replace('.', ' ').trim().ifEmpty { "TV Hub" }
            var out = clean
            while (out.toByteArray().size > 63) out = out.dropLast(1)
            return out
        }

        /** Prefer a private IPv4 address; fall back to whatever came first. */
        fun pickAddress(addresses: List<String>): String? =
            addresses.firstOrNull { it.count { c -> c == '.' } == 3 && !it.startsWith("127.") }
                ?: addresses.firstOrNull { !it.startsWith("fe80") && it != "::1" }
                ?: addresses.firstOrNull()
    }
}
