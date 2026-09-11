package io.nawah.linux.core.oci

import kotlinx.coroutines.flow.Flow
import java.io.File

/**
 * Pulls a distribution rootfs out of a container registry.
 *
 * Nawah ships no tarballs. Like modern `proot-distro`, it fetches the official
 * distro image from a registry at install time, which keeps the APK small and
 * means a machine installed today gets today's base image.
 *
 * This is an interface rather than a class so the provisioner can be unit-tested
 * without a socket; [HttpOciClient] is the only production implementation.
 */
public interface OciClient {

    /**
     * Resolves [image] (e.g. `library/debian:trixie`) for [arch] down to the one
     * layer that holds the rootfs, following a manifest list / image index when
     * the tag points at a multi-architecture image.
     *
     * @throws OciException if the image has no entry for [arch], if the manifest
     *   is malformed, or if it does not have exactly one layer.
     */
    public suspend fun resolveLayer(image: String, arch: OciArch): OciLayer

    /**
     * Downloads [layer] to [target], emitting [PullEvent.Progress] as bytes land
     * and finally [PullEvent.Completed].
     *
     * The SHA-256 is computed *while streaming* and compared to [OciLayer.digest]
     * before the file is handed over: the manifest already told us the hash, so
     * integrity costs one pass we were making anyway. A mismatch deletes the
     * partial file and fails — we never extract an unverified tarball.
     */
    public fun pullLayer(layer: OciLayer, target: File): Flow<PullEvent>

    /** Convenience: [resolveLayer] followed by [pullLayer]. */
    public fun pullLayer(image: String, arch: OciArch, target: File): Flow<PullEvent>
}
