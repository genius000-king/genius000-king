package io.nawah.linux.core.oci

import java.io.File
import java.util.Locale

/**
 * CPU architectures we can pull a rootfs for, expressed the way an OCI image
 * index spells them (`platform.architecture`) rather than the way Android does
 * (`Build.SUPPORTED_ABIS`). The two vocabularies differ, and the translation
 * lives here so nothing downstream has to remember it.
 */
public enum class OciArch(
    /** Value compared against `platform.architecture` in an image index. */
    public val architecture: String,
    /** Value compared against `platform.variant`, when the index bothers to set one. */
    public val variant: String?,
) {
    ARM64("arm64", "v8"),
    AMD64("amd64", null),
    ARM("arm", "v7"),
    X86("386", null),
    ;

    public companion object {
        /**
         * Maps an Android ABI string to the registry's architecture name.
         * Returns `null` for an ABI we have no rootfs for, so callers can fail
         * with a device-specific message instead of pulling the wrong image.
         */
        public fun fromAbi(abi: String): OciArch? = when (abi.lowercase(Locale.ROOT)) {
            "arm64-v8a", "aarch64", "arm64" -> ARM64
            "x86_64", "amd64" -> AMD64
            "armeabi-v7a", "armeabi", "arm" -> ARM
            "x86", "i686", "i386" -> X86
            else -> null
        }
    }
}

/**
 * A parsed image reference such as `library/debian:trixie`.
 *
 * Docker Hub's short form (`debian:trixie`) is expanded to `library/debian`
 * because the registry API only ever speaks the fully qualified repository name.
 */
public data class ImageRef(
    public val repository: String,
    public val reference: String,
) {
    /** True when [reference] is a content digest rather than a mutable tag. */
    public val isDigestRef: Boolean get() = reference.startsWith("sha256:")

    public companion object {
        // Registry path grammar (distribution spec): lowercase alphanumeric
        // components separated by single separators. Validating it here keeps a
        // hostile catalog entry from steering the request at a different API
        // path (`../../`) once it is pasted into the URL.
        private val REPO = Regex("^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$")
        private val TAG = Regex("^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$")

        /**
         * Parses `[repo][:tag|@digest]`, defaulting the tag to `latest` and the
         * namespace to `library` (Docker Hub's official-image namespace).
         *
         * @throws OciException when the reference is malformed.
         */
        public fun parse(image: String): ImageRef {
            val trimmed = image.trim()
            if (trimmed.isEmpty()) throw OciException("empty image reference")

            val atIndex = trimmed.indexOf('@')
            val repoPart: String
            val refPart: String
            if (atIndex >= 0) {
                repoPart = trimmed.substring(0, atIndex)
                refPart = Digests.require(trimmed.substring(atIndex + 1))
            } else {
                val colonIndex = trimmed.lastIndexOf(':')
                // A colon before the last '/' is a registry port, which we do not support.
                if (colonIndex > trimmed.lastIndexOf('/')) {
                    repoPart = trimmed.substring(0, colonIndex)
                    refPart = trimmed.substring(colonIndex + 1)
                } else {
                    repoPart = trimmed
                    refPart = "latest"
                }
            }

            val repo = if (repoPart.contains('/')) repoPart else "library/$repoPart"
            if (!REPO.matches(repo)) throw OciException("malformed repository: '$repoPart'")
            if (!refPart.startsWith("sha256:") && !TAG.matches(refPart)) {
                throw OciException("malformed tag: '$refPart'")
            }
            return ImageRef(repo, refPart)
        }
    }
}

/**
 * A single filesystem layer, as described by the image manifest.
 *
 * [digest] is the integrity anchor for the whole pull: the manifest is fetched
 * first, so by the time we stream the blob we already know the hash it must
 * produce.
 */
public data class OciLayer(
    /** Repository the blob is fetched from, e.g. `library/debian`. */
    public val repository: String,
    public val digest: String,
    public val sizeBytes: Long,
    public val mediaType: String,
) {
    /** True for the gzip-compressed tar layers both OCI and Docker v2 produce. */
    public val isGzip: Boolean
        get() = mediaType.endsWith("tar+gzip") || mediaType.endsWith("tar.gzip") ||
            mediaType == "application/x-gzip"
}

/** Streaming events emitted by [OciClient.pullLayer]. */
public sealed interface PullEvent {
    /**
     * Bytes written so far. [totalBytes] comes from the manifest descriptor, not
     * from a `Content-Length` header, so it is trustworthy and never zero.
     */
    public data class Progress(
        public val downloadedBytes: Long,
        public val totalBytes: Long,
    ) : PullEvent {
        public val fraction: Float
            get() = if (totalBytes <= 0L) 0f else (downloadedBytes.toDouble() / totalBytes).toFloat()
    }

    /** Terminal event: the blob is on disk and its SHA-256 matched [layer]. */
    public data class Completed(
        public val layer: OciLayer,
        public val file: File,
    ) : PullEvent
}

/** Anything the registry conversation can get wrong. */
public class OciException(
    message: String,
    cause: Throwable? = null,
) : java.io.IOException(message, cause)

/**
 * Digest hygiene. Registry responses are untrusted input, and a digest string
 * ends up both in a URL path and in a hash comparison, so it is validated once,
 * here, before either use.
 */
public object Digests {
    private val SHA256 = Regex("^sha256:[0-9a-f]{64}$")

    /** @throws OciException unless [value] is exactly `sha256:` + 64 lowercase hex digits. */
    public fun require(value: String): String {
        if (!SHA256.matches(value)) throw OciException("malformed digest: '$value'")
        return value
    }

    public fun isValid(value: String): Boolean = SHA256.matches(value)

    /** The 64-character hex body of a validated digest. */
    public fun hex(value: String): String = require(value).substring("sha256:".length)

    /** Renders raw SHA-256 bytes as the `sha256:<hex>` form used by manifests. */
    public fun format(bytes: ByteArray): String = buildString(7 + bytes.size * 2) {
        append("sha256:")
        for (b in bytes) {
            val v = b.toInt() and 0xFF
            append("0123456789abcdef"[v ushr 4])
            append("0123456789abcdef"[v and 0x0F])
        }
    }
}
