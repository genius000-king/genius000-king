package io.nawah.linux.core.oci

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Wire models for the subset of the OCI distribution spec we speak.
 *
 * These are `internal` on purpose: they are a transport detail, and callers get
 * [OciLayer] instead. Every field is optional or defaulted because registries
 * routinely add keys (`subject`, `annotations`, `artifactType`) and a pull must
 * not start failing because Docker Hub shipped a new attribute on a Tuesday.
 */
internal val OciJson: Json = Json {
    ignoreUnknownKeys = true
    isLenient = false
    explicitNulls = false
}

@Serializable
internal data class WirePlatform(
    val architecture: String = "",
    val os: String = "",
    val variant: String? = null,
    @SerialName("os.version") val osVersion: String? = null,
)

@Serializable
internal data class WireDescriptor(
    val mediaType: String = "",
    val digest: String = "",
    val size: Long = 0L,
    val platform: WirePlatform? = null,
)

/** `application/vnd.oci.image.index.v1+json` / `...manifest.list.v2+json`. */
@Serializable
internal data class WireIndex(
    val schemaVersion: Int = 2,
    val mediaType: String? = null,
    val manifests: List<WireDescriptor> = emptyList(),
)

/** `application/vnd.oci.image.manifest.v1+json` / `...manifest.v2+json`. */
@Serializable
internal data class WireManifest(
    val schemaVersion: Int = 2,
    val mediaType: String? = null,
    val config: WireDescriptor? = null,
    val layers: List<WireDescriptor> = emptyList(),
)

@Serializable
internal data class WireToken(
    val token: String? = null,
    @SerialName("access_token") val accessToken: String? = null,
) {
    /**
     * Docker Hub returns `token`; some registries return only `access_token`.
     * Both are the same bearer credential.
     */
    val bearer: String? get() = token?.takeIf { it.isNotBlank() } ?: accessToken?.takeIf { it.isNotBlank() }
}
