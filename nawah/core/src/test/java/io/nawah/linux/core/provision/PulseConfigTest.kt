package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The audio switch used to do nothing at all.
 *
 * The app exported `PULSE_SERVER=tcp:127.0.0.1:4713` into every machine with
 * sound enabled, and nothing anywhere had ever listened on that port — no
 * server was built, shipped or started. These pin the arrangement that
 * replaced it, against the argument names the shipped
 * `module-simple-protocol-tcp.so` actually documents.
 */
class PulseConfigTest {

    private val speakerOnly = GuestScripts.pulseConfig(microphone = false)
    private val withMic = GuestScripts.pulseConfig(microphone = true)

    @Test
    fun `the guest plays into a null sink, because there is no sound card`() {
        // A proot container has no audio device and cannot be given one. The
        // null sink is what makes the audio reachable at all: its monitor is
        // what the app reads.
        assertThat(speakerOnly).contains("load-module module-null-sink sink_name=nawah_out")
        assertThat(speakerOnly).contains("set-default-sink nawah_out")
    }

    @Test
    fun `the monitor is served over loopback in a format needing no conversion`() {
        assertThat(speakerOnly).contains("module-simple-protocol-tcp record=true")
        assertThat(speakerOnly).contains("source=nawah_out.monitor")
        assertThat(speakerOnly).contains("listen=127.0.0.1 port=4713")
        assertThat(speakerOnly).contains("format=s16le rate=48000 channels=2")
    }

    @Test
    fun `the microphone is the same path backwards, on its own port`() {
        assertThat(withMic).contains("module-simple-protocol-tcp playback=true")
        assertThat(withMic).contains("sink=nawah_mic")
        assertThat(withMic).contains("port=4714")
        assertThat(withMic).contains("set-default-source nawah_mic.monitor")
    }

    @Test
    fun `a machine without a microphone gets no microphone modules`() {
        assertThat(speakerOnly).doesNotContain("nawah_mic")
        assertThat(speakerOnly).doesNotContain("4714")
    }

    @Test
    fun `a failing module must not take the rest of the audio down`() {
        // .fail would abort the whole configuration on one bad line, so a
        // microphone module that will not load would silence the speaker too.
        assertThat(speakerOnly).contains(".nofail")
        assertThat(speakerOnly).doesNotContain("\n.fail")
    }

    @Test
    fun `the ports and format the app connects with are the ones configured`() {
        // One source of truth: the Android side reads these same constants.
        assertThat(speakerOnly).contains("port=${GuestScripts.AUDIO_OUT_PORT}")
        assertThat(withMic).contains("port=${GuestScripts.AUDIO_IN_PORT}")
        assertThat(speakerOnly).contains("rate=${GuestScripts.AUDIO_RATE}")
        assertThat(speakerOnly).contains("format=${GuestScripts.AUDIO_FORMAT}")
    }
}
