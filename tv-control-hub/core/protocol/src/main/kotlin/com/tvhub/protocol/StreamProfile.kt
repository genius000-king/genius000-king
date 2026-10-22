package com.tvhub.protocol

/**
 * Video profile both ends agree on. The TV scales its screen to this size before encoding,
 * so the phone can map a touch to the TV screen without knowing the TV's resolution.
 */
object StreamProfile {
    const val WIDTH: Int = 1280
    const val HEIGHT: Int = 720
    const val FPS: Int = 30
}

/** Default port of the TV control server. The phone sends its control traffic here. */
const val CONTROL_PORT: Int = 8787

/** WebSocket path of the control channel. */
const val CONTROL_PATH: String = "/control"
