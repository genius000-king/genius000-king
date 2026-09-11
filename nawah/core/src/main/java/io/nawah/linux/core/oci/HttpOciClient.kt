package io.nawah.linux.core.oci

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.jsonObject
import okhttp3.Call
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * OkHttp-backed [OciClient] speaking the Docker Hub dialect of the OCI
 * distribution API.
 *
 * The conversation is three requests:
 *  1. `GET auth.docker.io/token?service=…&scope=repository:<repo>:pull` for an
 *     anonymous bearer token — Docker Hub rejects `/v2/` without one even for
 *     public images.
 *  2. `GET registry-1.docker.io/v2/<repo>/manifests/<ref>` which, for an
 *     official image, returns a *manifest list* covering every architecture.
 *     We pick ours and fetch the child manifest by digest.
 *  3. `GET /v2/<repo>/blobs/<digest>` for the rootfs layer.
 *
 * Every response is treated as hostile: digests are pattern-checked before they
 * are interpolated into a URL, manifest bodies are size-capped so a malicious
 * registry cannot OOM the app, and the blob is hashed as it streams.
 *
 * @param callFactory injected so tests can drive a local socket (or a canned
 *   responder) instead of the network.
 */
public class HttpOciClient(
    private val callFactory: Call.Factory = defaultHttpClient(),
    private val registryBaseUrl: HttpUrl = "https://registry-1.docker.io/".toHttpUrl(),
    private val authBaseUrl: HttpUrl = "https://auth.docker.io/".toHttpUrl(),
    private val authService: String = "registry.docker.io",
    private val io: CoroutineDispatcher = Dispatchers.IO,
) : OciClient {

    override suspend fun resolveLayer(image: String, arch: OciArch): OciLayer {
        val ref = ImageRef.parse(image)
        val token = fetchToken(ref.repository)

        var reference = ref.reference
        var manifestBody = fetchManifest(ref.repository, reference, token)

        // An image index can in principle point at another index. One extra hop
        // covers every real registry; more than that is a loop we refuse to run.
        var hops = 0
        while (true) {
            val root = runCatching { OciJson.parseToJsonElement(manifestBody).jsonObject }
                .getOrElse { throw OciException("manifest for $image is not a JSON object", it) }
            if (!root.containsKey("manifests")) break
            if (hops++ >= MAX_INDEX_HOPS) {
                throw OciException("manifest index for $image nests more than $MAX_INDEX_HOPS levels")
            }
            val index = OciJson.decodeFromString(WireIndex.serializer(), manifestBody)
            reference = selectPlatform(index, arch, image)
            manifestBody = fetchManifest(ref.repository, reference, token)
        }

        val manifest = runCatching {
            OciJson.decodeFromString(WireManifest.serializer(), manifestBody)
        }.getOrElse { throw OciException("unreadable manifest for $image", it) }

        val layers = manifest.layers
        if (layers.isEmpty()) throw OciException("manifest for $image declares no layers")
        if (layers.size != 1) {
            // A rootfs image is a single squashed layer. Anything else would need
            // ordered extraction with whiteout handling, which Nawah deliberately
            // does not implement -- fail loudly rather than build half a rootfs.
            throw OciException(
                "image $image has ${layers.size} layers; Nawah expects a single-layer rootfs image",
            )
        }
        val layer = layers.single()
        return OciLayer(
            repository = ref.repository,
            digest = Digests.require(layer.digest),
            sizeBytes = layer.size,
            mediaType = layer.mediaType,
        )
    }

    override fun pullLayer(image: String, arch: OciArch, target: File): Flow<PullEvent> = flow<PullEvent> {
        val layer = resolveLayer(image, arch)
        emitAll(pullLayer(layer, target))
    }.flowOn(io)

    override fun pullLayer(layer: OciLayer, target: File): Flow<PullEvent> = flow {
        Digests.require(layer.digest)
        val parent = target.parentFile ?: throw OciException("target $target has no parent directory")
        requireInside(parent, target)
        parent.mkdirs()

        val token = fetchToken(layer.repository)
        val url = registryBaseUrl.newBuilder()
            .addPathSegments("v2/${layer.repository}/blobs/${layer.digest}")
            .build()
        val call = callFactory.newCall(
            Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .header("Accept", "*/*")
                .build(),
        )

        // A partial file from an interrupted earlier attempt is never resumed:
        // we cannot verify a prefix, and the digest is only meaningful over the
        // whole blob.
        target.delete()

        val digest = MessageDigest.getInstance("SHA-256")
        var written = 0L
        val response = call.await()
        try {
            if (!response.isSuccessful) {
                throw OciException("blob ${layer.digest} returned HTTP ${response.code}")
            }
            emit(PullEvent.Progress(0L, layer.sizeBytes))
            response.body.byteStream().use { input ->
                FileOutputStream(target).use { output ->
                    val buffer = ByteArray(DOWNLOAD_BUFFER)
                    var lastEmit = 0L
                    while (true) {
                        currentCoroutineContext().ensureActive()
                        val read = input.read(buffer)
                        if (read < 0) break
                        if (read == 0) continue
                        digest.update(buffer, 0, read)
                        output.write(buffer, 0, read)
                        written += read
                        if (layer.sizeBytes in 1 until written) {
                            throw OciException(
                                "blob ${layer.digest} is longer than its declared ${layer.sizeBytes} bytes",
                            )
                        }
                        // Throttle: a 60 MB rootfs at 32 KB a read is ~2000 events,
                        // which would spam a progress bar redrawing at 60 Hz.
                        if (written - lastEmit >= PROGRESS_STEP) {
                            lastEmit = written
                            emit(PullEvent.Progress(written, layer.sizeBytes))
                        }
                    }
                    output.flush()
                    output.fd.sync()
                }
            }
        } catch (t: Throwable) {
            target.delete()
            throw t
        } finally {
            response.closeQuietly()
        }

        val actual = Digests.format(digest.digest())
        if (!MessageDigest.isEqual(actual.toByteArray(), layer.digest.toByteArray())) {
            target.delete()
            throw OciException(
                "digest mismatch for ${layer.repository}: manifest said ${layer.digest}, blob hashed to $actual",
            )
        }
        if (layer.sizeBytes > 0 && written != layer.sizeBytes) {
            target.delete()
            throw OciException("blob ${layer.digest} is $written bytes, manifest said ${layer.sizeBytes}")
        }

        emit(PullEvent.Progress(written, if (layer.sizeBytes > 0) layer.sizeBytes else written))
        emit(PullEvent.Completed(layer.copy(sizeBytes = written), target))
    }.flowOn(io)

    // ---- registry plumbing ---------------------------------------------------

    /** Anonymous pull token. Public images still need one on Docker Hub. */
    internal suspend fun fetchToken(repository: String): String = withContext(io) {
        val url = authBaseUrl.newBuilder()
            .addPathSegment("token")
            .addQueryParameter("service", authService)
            .addQueryParameter("scope", "repository:$repository:pull")
            .build()
        val response = callFactory.newCall(Request.Builder().url(url).get().build()).await()
        val body = response.use {
            if (!it.isSuccessful) throw OciException("token request failed: HTTP ${it.code}")
            it.readCapped(MAX_TOKEN_BYTES, "token response")
        }
        val parsed = runCatching { OciJson.decodeFromString(WireToken.serializer(), body) }
            .getOrElse { throw OciException("unreadable token response", it) }
        parsed.bearer ?: throw OciException("token response for $repository carried no token")
    }

    private suspend fun fetchManifest(repository: String, reference: String, token: String): String {
        // `reference` is either a caller-supplied tag (validated in ImageRef) or a
        // digest taken from an index -- re-validate the latter before it becomes
        // part of a URL path.
        if (reference.startsWith("sha256:")) Digests.require(reference)
        val url = registryBaseUrl.newBuilder()
            .addPathSegments("v2/$repository/manifests/$reference")
            .build()
        val response = callFactory.newCall(
            Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .header("Accept", MANIFEST_ACCEPT)
                .get()
                .build(),
        ).await()
        return response.use {
            if (!it.isSuccessful) {
                throw OciException("manifest $repository:$reference returned HTTP ${it.code}")
            }
            it.readCapped(MAX_MANIFEST_BYTES, "manifest $repository:$reference")
        }
    }

    private fun selectPlatform(index: WireIndex, arch: OciArch, image: String): String {
        val candidates = index.manifests.filter {
            it.platform?.os == "linux" && it.platform.architecture == arch.architecture
        }
        if (candidates.isEmpty()) {
            val seen = index.manifests.mapNotNull { it.platform }
                .joinToString(", ") { "${it.os}/${it.architecture}${it.variant?.let { v -> "/$v" }.orEmpty()}" }
            throw OciException(
                "image $image has no linux/${arch.architecture} entry (available: ${seen.ifEmpty { "none" }})",
            )
        }
        // Prefer an exact variant match (arm64/v8) but accept an unqualified entry.
        val chosen = candidates.firstOrNull { it.platform?.variant == arch.variant }
            ?: candidates.firstOrNull { it.platform?.variant.isNullOrEmpty() }
            ?: candidates.first()
        return Digests.require(chosen.digest)
    }

    private companion object {
        const val MANIFEST_ACCEPT: String =
            "application/vnd.oci.image.index.v1+json, " +
                "application/vnd.docker.distribution.manifest.list.v2+json, " +
                "application/vnd.oci.image.manifest.v1+json, " +
                "application/vnd.docker.distribution.manifest.v2+json"

        /** Real manifests are a few kilobytes; 1 MiB is absurdly generous. */
        const val MAX_MANIFEST_BYTES: Long = 1L shl 20
        const val MAX_TOKEN_BYTES: Long = 64L shl 10
        const val MAX_INDEX_HOPS: Int = 2
        const val DOWNLOAD_BUFFER: Int = 64 * 1024
        const val PROGRESS_STEP: Long = 256 * 1024
    }
}

/** Sensible defaults: no read timeout, because a 60 MB layer on hotel wifi is slow, not stuck. */
public fun defaultHttpClient(): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(0, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .retryOnConnectionFailure(true)
    .build()

/** Bridges OkHttp's callback API to coroutines, cancelling the call on cancellation. */
internal suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
    cont.invokeOnCancellation { runCatching { cancel() } }
    enqueue(
        object : okhttp3.Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (!cont.isCancelled) cont.resumeWithException(e)
            }

            override fun onResponse(call: Call, response: Response) {
                cont.resume(response)
            }
        },
    )
}

internal fun Response.closeQuietly() {
    runCatching { close() }
}

/**
 * Reads at most [limit] bytes of the body as UTF-8, failing rather than
 * truncating. Truncating would hand a half-JSON document to the parser and turn
 * a denial-of-service attempt into a confusing parse error.
 */
internal fun Response.readCapped(limit: Long, what: String): String {
    val stream = body.byteStream()
    val out = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8 * 1024)
    var total = 0L
    while (true) {
        val read = stream.read(buffer)
        if (read < 0) break
        total += read
        if (total > limit) throw OciException("$what exceeds the $limit byte cap")
        out.write(buffer, 0, read)
    }
    return out.toString(Charsets.UTF_8.name())
}

/**
 * Guards against a path escaping [dir]. Nothing in the pull derives a filename
 * from registry data today, and this makes sure that stays true if it ever does.
 */
internal fun requireInside(dir: File, candidate: File) {
    val root = dir.canonicalFile.path.trimEnd(File.separatorChar) + File.separatorChar
    val path = candidate.canonicalFile.path
    if (!path.startsWith(root)) {
        throw OciException("refusing to write $candidate outside $dir")
    }
}
