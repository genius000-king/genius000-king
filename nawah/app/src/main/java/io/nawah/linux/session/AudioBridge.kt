package io.nawah.linux.session

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import io.nawah.linux.core.provision.GuestScripts
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.Socket
import kotlin.concurrent.thread

/**
 * Carries sound between the container and Android's audio devices.
 *
 * There is no sound card inside a proot container, and Android's output is not
 * reachable from inside one. So PulseAudio runs in the guest playing into a
 * null sink, and serves that sink's monitor as raw PCM over loopback TCP; this
 * connects, reads the bytes, and hands them to an [AudioTrack]. The microphone
 * is the same path backwards.
 *
 * Loopback needs no forwarding and no bind: proot creates no network namespace,
 * so `127.0.0.1` inside the container is `127.0.0.1` here.
 *
 * What this replaced was a lie. The app exported `PULSE_SERVER=tcp:127.0.0.1:4713`
 * into every machine with sound enabled, and nothing anywhere had ever listened
 * on that port — no server was built, shipped or started. The switch in the
 * wizard did nothing at all.
 */
internal class AudioBridge(
    private val context: Context,
    private val log: (String) -> Unit,
) {

    @Volatile private var running = false
    private var speaker: Thread? = null
    private var microphone: Thread? = null

    /**
     * Starts the pumps. Returns immediately; both run until [stop].
     *
     * The guest's audio server is still starting when this is called, so each
     * pump retries for [CONNECT_TIMEOUT_MS] before giving up. Giving up is not
     * fatal: a silent desktop is worth far more than no desktop.
     */
    fun start(speakerOut: Boolean, microphoneIn: Boolean) {
        stop()
        running = true
        if (speakerOut) speaker = thread(name = "nawah-audio-out", isDaemon = true) { pumpSpeaker() }
        if (microphoneIn) microphone = thread(name = "nawah-audio-in", isDaemon = true) { pumpMicrophone() }
    }

    fun stop() {
        running = false
        speaker?.interrupt()
        microphone?.interrupt()
        speaker = null
        microphone = null
    }

    // -- speaker: guest -> phone ---------------------------------------------

    private fun pumpSpeaker() {
        val socket = connect(GuestScripts.AUDIO_OUT_PORT, "speaker") ?: return
        val track = buildTrack() ?: run {
            log("nawah: this device refused to open an audio output")
            runCatching { socket.close() }
            return
        }
        log("nawah: sound is connected")
        socket.use { s ->
            track.play()
            runCatching { copy(s.getInputStream(), track) }
            runCatching { track.stop() }
            track.release()
        }
        if (running) log("nawah: the sound connection closed")
    }

    private fun buildTrack(): AudioTrack? = runCatching {
        val minimum = AudioTrack.getMinBufferSize(
            GuestScripts.AUDIO_RATE,
            AudioFormat.CHANNEL_OUT_STEREO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_UNKNOWN)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(GuestScripts.AUDIO_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                    .build(),
            )
            // Four times the minimum: the guest is a ptraced process tree whose
            // scheduling is uneven, and a buffer sized for a well-behaved
            // producer underruns audibly on every apt run.
            .setBufferSizeInBytes(minimum * 4)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
    }.getOrNull()

    private fun copy(input: InputStream, track: AudioTrack) {
        val buffer = ByteArray(CHUNK_BYTES)
        while (running && !Thread.currentThread().isInterrupted) {
            val read = input.read(buffer)
            if (read <= 0) return
            var written = 0
            while (written < read) {
                val n = track.write(buffer, written, read - written)
                if (n <= 0) return
                written += n
            }
        }
    }

    // -- microphone: phone -> guest ------------------------------------------

    private fun pumpMicrophone() {
        // Checked rather than caught. The switch asks Android for this when it
        // is turned on, but the grant can be revoked from settings afterwards,
        // and a SecurityException surfacing as "no sound" explains nothing.
        if (!hasMicrophonePermission()) {
            log("nawah: the microphone permission is not granted; recording is off")
            return
        }
        val socket = connect(GuestScripts.AUDIO_IN_PORT, "microphone") ?: return
        val record = buildRecord() ?: run {
            log("nawah: this device refused to open the microphone")
            runCatching { socket.close() }
            return
        }
        log("nawah: the microphone is connected")
        socket.use { s ->
            record.startRecording()
            runCatching { copy(record, s.getOutputStream()) }
            runCatching { record.stop() }
            record.release()
        }
    }

    private fun hasMicrophonePermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    /**
     * The permission check sits immediately before the constructor rather than
     * in the caller, so that both a reader and lint can see that the one
     * guards the other.
     */
    private fun buildRecord(): AudioRecord? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return null
        }
        val minimum = AudioRecord.getMinBufferSize(
            GuestScripts.AUDIO_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        val record = try {
            AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                GuestScripts.AUDIO_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                minimum * 4,
            )
        } catch (e: Exception) {
            return null
        }
        return record.takeIf { it.state == AudioRecord.STATE_INITIALIZED }
    }

    private fun copy(record: AudioRecord, output: OutputStream) {
        val buffer = ByteArray(CHUNK_BYTES)
        while (running && !Thread.currentThread().isInterrupted) {
            val read = record.read(buffer, 0, buffer.size)
            if (read <= 0) return
            output.write(buffer, 0, read)
            output.flush()
        }
    }

    // -- shared ---------------------------------------------------------------

    /** Retries while the guest's audio server is still coming up. */
    private fun connect(port: Int, what: String): Socket? {
        val deadline = System.currentTimeMillis() + CONNECT_TIMEOUT_MS
        while (running && System.currentTimeMillis() < deadline) {
            val socket = runCatching {
                Socket(InetAddress.getByName("127.0.0.1"), port).apply { tcpNoDelay = true }
            }.getOrNull()
            if (socket != null) return socket
            runCatching { Thread.sleep(RETRY_MS) }.getOrElse { return null }
        }
        if (running) log("nawah: no $what connection after ${CONNECT_TIMEOUT_MS / 1000}s; the desktop will be silent")
        return null
    }

    private companion object {
        /** 20 ms of stereo 48 kHz PCM. Small enough to keep latency tolerable. */
        const val CHUNK_BYTES = 48_000 / 50 * 2 * 2

        const val CONNECT_TIMEOUT_MS = 20_000L
        const val RETRY_MS = 400L
    }
}
