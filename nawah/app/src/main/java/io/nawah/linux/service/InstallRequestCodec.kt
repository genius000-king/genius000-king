package io.nawah.linux.service

import android.content.Intent
import io.nawah.linux.core.provision.InstallRequest
import kotlinx.serialization.json.Json

/**
 * Carries an [InstallRequest] across the Intent boundary into [InstallService].
 *
 * JSON rather than Parcelable: the request is already `@Serializable` all the
 * way down (it is built from the catalog, which is itself JSON), and a hand
 * written Parcelable would be a second, silently divergent copy of the same
 * schema.
 */
internal object InstallRequestCodec {

    private const val EXTRA = "io.nawah.linux.extra.INSTALL_REQUEST"
    private val json = Json { ignoreUnknownKeys = true }

    fun encode(intent: Intent, request: InstallRequest) {
        intent.putExtra(EXTRA, json.encodeToString(request))
    }

    fun decode(intent: Intent): InstallRequest? =
        intent.getStringExtra(EXTRA)?.let {
            runCatching { json.decodeFromString<InstallRequest>(it) }.getOrNull()
        }
}
