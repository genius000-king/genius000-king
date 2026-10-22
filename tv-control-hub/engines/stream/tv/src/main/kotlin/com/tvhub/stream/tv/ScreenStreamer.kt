package com.tvhub.stream.tv

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.util.Log
import com.tvhub.protocol.IceCandidate
import com.tvhub.protocol.ProtocolMessage
import com.tvhub.protocol.SdpOffer
import com.tvhub.protocol.StreamProfile
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RtpTransceiver
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import java.util.concurrent.ConcurrentHashMap

/**
 * Captures the TV screen with MediaProjection and sends it to every connected viewer.
 *
 * Capture is a single long-lived session. On Android 14+ a MediaProjection token is single-use,
 * so viewers can connect and leave while the capture keeps running. The caller must keep the
 * foreground service alive for as long as the capture is needed.
 *
 * [send] delivers signalling messages for a given peer. The caller routes them over the control channel.
 */
class ScreenStreamer(
    context: Context,
    private val send: (peerId: String, message: ProtocolMessage) -> Unit,
) {
    private val appContext = context.applicationContext
    private val eglBase: EglBase = EglBase.create()
    private val factory: PeerConnectionFactory = createFactory()
    private val peers = ConcurrentHashMap<String, PeerConnection>()

    private var capturer: ScreenCapturerAndroid? = null
    private var surfaceHelper: SurfaceTextureHelper? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null

    val isCapturing: Boolean
        get() = videoTrack != null

    /**
     * Starts the capture from the MediaProjection consent intent.
     * Call it only after the service is in the foreground.
     */
    fun startCapture(consent: Intent, onStopped: () -> Unit) {
        if (isCapturing) return

        val screen = ScreenCapturerAndroid(
            consent,
            object : MediaProjection.Callback() {
                override fun onStop() = onStopped()
            },
        )
        val helper = SurfaceTextureHelper.create("ScreenCaptureThread", eglBase.eglBaseContext)
        val source = factory.createVideoSource(screen.isScreencast)
        screen.initialize(helper, appContext, source.capturerObserver)
        screen.startCapture(StreamProfile.WIDTH, StreamProfile.HEIGHT, StreamProfile.FPS)

        capturer = screen
        surfaceHelper = helper
        videoSource = source
        videoTrack = factory.createVideoTrack(TRACK_ID, source)
    }

    /** Creates a connection for one viewer and sends it an offer. Replaces any earlier connection to that viewer. */
    fun openPeer(peerId: String) {
        val track = videoTrack ?: return
        closePeer(peerId)

        val peer = factory.createPeerConnection(rtcConfig(), PeerObserver(peerId)) ?: return
        peers[peerId] = peer

        val transceiver = peer.addTransceiver(
            track,
            RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.SEND_ONLY, listOf(STREAM_ID)),
        )
        preferH264(transceiver)

        peer.createOffer(
            object : SimpleSdpObserver() {
                override fun onCreateSuccess(description: SessionDescription) {
                    peer.setLocalDescription(
                        object : SimpleSdpObserver() {
                            override fun onSetSuccess() = send(peerId, SdpOffer(description.description))
                        },
                        description,
                    )
                }
            },
            MediaConstraints(),
        )
    }

    fun onAnswer(peerId: String, sdp: String) {
        peers[peerId]?.setRemoteDescription(
            SimpleSdpObserver(),
            SessionDescription(SessionDescription.Type.ANSWER, sdp),
        )
    }

    fun onRemoteCandidate(peerId: String, candidate: IceCandidate) {
        peers[peerId]?.addIceCandidate(
            org.webrtc.IceCandidate(candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate),
        )
    }

    fun closePeer(peerId: String) {
        peers.remove(peerId)?.apply {
            close()
            dispose()
        }
    }

    fun dispose() {
        peers.keys.toList().forEach { closePeer(it) }
        capturer?.stopCapture()
        capturer?.dispose()
        videoTrack?.dispose()
        videoSource?.dispose()
        surfaceHelper?.dispose()
        capturer = null
        videoTrack = null
        videoSource = null
        surfaceHelper = null
        factory.dispose()
        eglBase.release()
    }

    /** Hardware H.264 keeps the TV's CPU low. Without this, the software VP8 encoder would be used. */
    private fun preferH264(transceiver: RtpTransceiver) {
        val h264 = factory.getRtpSenderCapabilities(MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO)
            .codecs
            .filter { it.name.equals("H264", ignoreCase = true) }
        if (h264.isNotEmpty()) transceiver.setCodecPreferences(h264)
    }

    private fun createFactory(): PeerConnectionFactory {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appContext).createInitializationOptions(),
        )
        return PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .createPeerConnectionFactory()
    }

    private fun rtcConfig(): PeerConnection.RTCConfiguration =
        // LAN only: host candidates, so no STUN or TURN servers.
        PeerConnection.RTCConfiguration(emptyList())

    // WebRTC's Observer interface requires all of these methods, so the count cannot shrink.
    @Suppress("TooManyFunctions")
    private inner class PeerObserver(private val peerId: String) : PeerConnection.Observer {
        override fun onIceCandidate(candidate: org.webrtc.IceCandidate) {
            send(peerId, IceCandidate(candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex))
        }

        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
            Log.i(TAG, "peer $peerId ICE state $state")
        }

        override fun onSignalingChange(state: PeerConnection.SignalingState) = Unit

        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit

        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) = Unit

        override fun onIceCandidatesRemoved(candidates: Array<out org.webrtc.IceCandidate>?) = Unit

        override fun onAddStream(stream: MediaStream?) = Unit

        override fun onRemoveStream(stream: MediaStream?) = Unit

        override fun onDataChannel(channel: DataChannel?) = Unit

        override fun onRenegotiationNeeded() = Unit

        override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) = Unit
    }

    private open class SimpleSdpObserver : SdpObserver {
        override fun onCreateSuccess(description: SessionDescription) = Unit

        override fun onSetSuccess() = Unit

        override fun onCreateFailure(error: String?) {
            Log.e(TAG, "SDP create failed: $error")
        }

        override fun onSetFailure(error: String?) {
            Log.e(TAG, "SDP set failed: $error")
        }
    }

    private companion object {
        const val TAG = "ScreenStreamer"
        const val TRACK_ID = "screen0"
        const val STREAM_ID = "screen"
    }
}
