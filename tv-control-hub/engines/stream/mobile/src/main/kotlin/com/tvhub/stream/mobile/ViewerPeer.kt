package com.tvhub.stream.mobile

import android.content.Context
import android.util.Log
import com.tvhub.protocol.IceCandidate
import com.tvhub.protocol.ProtocolMessage
import com.tvhub.protocol.SdpAnswer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.VideoTrack

/**
 * Receives the TV's screen. The TV offers, this peer answers. ICE candidates are exchanged over [send].
 * One peer is kept at a time: a new offer replaces the previous connection.
 */
class ViewerPeer(
    context: Context,
    private val send: (ProtocolMessage) -> Unit,
) {
    private val eglBase: EglBase = EglBase.create()
    private val factory: PeerConnectionFactory = createFactory(context.applicationContext)

    private val lock = Any()
    private var peer: PeerConnection? = null
    private var remoteDescriptionSet = false
    private val pendingCandidates = mutableListOf<org.webrtc.IceCandidate>()

    private val _track = MutableStateFlow<VideoTrack?>(null)
    val track: StateFlow<VideoTrack?> = _track.asStateFlow()

    val eglContext: EglBase.Context
        get() = eglBase.eglBaseContext

    fun onOffer(sdp: String) {
        close()
        val created = synchronized(lock) {
            factory.createPeerConnection(PeerConnection.RTCConfiguration(emptyList()), PeerObserver())
                ?.also { peer = it }
        } ?: return

        created.setRemoteDescription(
            object : SimpleSdpObserver() {
                override fun onSetSuccess() {
                    synchronized(lock) {
                        remoteDescriptionSet = true
                        pendingCandidates.forEach { created.addIceCandidate(it) }
                        pendingCandidates.clear()
                    }
                    createAnswer(created)
                }
            },
            SessionDescription(SessionDescription.Type.OFFER, sdp),
        )
    }

    fun onRemoteCandidate(candidate: IceCandidate) {
        val webrtcCandidate = org.webrtc.IceCandidate(candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate)
        synchronized(lock) {
            val current = peer
            if (remoteDescriptionSet && current != null) {
                current.addIceCandidate(webrtcCandidate)
            } else {
                pendingCandidates += webrtcCandidate
            }
        }
    }

    fun close() {
        synchronized(lock) {
            peer?.apply {
                close()
                dispose()
            }
            peer = null
            remoteDescriptionSet = false
            pendingCandidates.clear()
        }
        _track.value = null
    }

    fun release() {
        close()
        factory.dispose()
        eglBase.release()
    }

    private fun createAnswer(connection: PeerConnection) {
        connection.createAnswer(
            object : SimpleSdpObserver() {
                override fun onCreateSuccess(description: SessionDescription) {
                    connection.setLocalDescription(
                        object : SimpleSdpObserver() {
                            override fun onSetSuccess() = send(SdpAnswer(description.description))
                        },
                        description,
                    )
                }
            },
            MediaConstraints(),
        )
    }

    // WebRTC's Observer interface requires all of these methods, so the count cannot shrink.
    @Suppress("TooManyFunctions")
    private inner class PeerObserver : PeerConnection.Observer {
        override fun onIceCandidate(candidate: org.webrtc.IceCandidate) {
            send(IceCandidate(candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex))
        }

        override fun onTrack(transceiver: RtpTransceiver) {
            (transceiver.receiver.track() as? VideoTrack)?.let { _track.value = it }
        }

        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
            Log.i(TAG, "ICE state $state")
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
        const val TAG = "ViewerPeer"

        fun createFactory(context: Context): PeerConnectionFactory {
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions(),
            )
            return PeerConnectionFactory.builder().createPeerConnectionFactory()
        }
    }
}
