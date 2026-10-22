package com.tvhub.protocol

/** Protocol version implemented by this build. Bump it on any change that breaks existing peers. */
const val PROTOCOL_VERSION: Int = 1

/** Oldest peer version this build still accepts. */
const val MIN_SUPPORTED_PROTOCOL_VERSION: Int = 1

/**
 * Returns the version both peers will speak, or null when the peer is too old.
 * A newer peer is served at our version, so it must keep supporting ours.
 */
fun negotiateProtocolVersion(peerVersion: Int): Int? {
    if (peerVersion < MIN_SUPPORTED_PROTOCOL_VERSION) return null
    return minOf(peerVersion, PROTOCOL_VERSION)
}
