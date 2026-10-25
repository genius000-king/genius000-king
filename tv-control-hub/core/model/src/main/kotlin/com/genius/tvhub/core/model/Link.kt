package com.genius.tvhub.core.model

/** A TV seen on the network (or remembered from before). */
data class TvEndpoint(
    val id: String,
    val name: String,
    val host: String,
    val port: Int,
    val paired: Boolean,
)

/** Why a connection is not up. Each maps to one sentence on screen. */
enum class LinkFailure { NO_NETWORK, NOT_FOUND, REFUSED, KEY_CHANGED, VERSION_MISMATCH, UNREACHABLE }

/** The phone's connection to its TV, as every screen sees it. */
sealed interface LinkState {
    /** Looking for TVs; [found] fills in as they answer. */
    data class Searching(val found: List<TvEndpoint> = emptyList()) : LinkState
    data class Connecting(val tv: TvEndpoint) : LinkState
    /** First pairing: the TV is asking its owner. [code] is on both screens. */
    data class AwaitingApproval(val tv: TvEndpoint, val code: String) : LinkState
    data class Connected(val tv: TvEndpoint, val latencyMillis: Int?, val grants: Grants) : LinkState
    /** Dropped; trying again by itself. */
    data class Reconnecting(val tv: TvEndpoint, val attempt: Int) : LinkState
    data class Failed(val tv: TvEndpoint?, val failure: LinkFailure) : LinkState
}
