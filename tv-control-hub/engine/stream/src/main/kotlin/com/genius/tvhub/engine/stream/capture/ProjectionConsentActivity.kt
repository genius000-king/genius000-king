package com.genius.tvhub.engine.stream.capture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import kotlinx.coroutines.CompletableDeferred

/**
 * Invisible activity that shows Android's "start recording?" prompt on the TV and hands the
 * answer back. One prompt per projection (an Android 14 rule); skippable once with
 * `adb shell appops set <pkg> PROJECT_MEDIA allow`.
 */
class ProjectionConsentActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) {
            startActivityForResult(getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent(), REQUEST)
        }
    }

    @Deprecated("platform API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        pending?.complete(if (resultCode == RESULT_OK && data != null) Consent(resultCode, data) else null)
        pending = null
        finish()
    }

    class Consent(val resultCode: Int, val data: Intent)

    companion object {
        private const val REQUEST = 7
        @Volatile private var pending: CompletableDeferred<Consent?>? = null

        /** Shows the prompt and suspends until the person at the TV answers. */
        suspend fun request(context: Context): Consent? {
            val deferred = CompletableDeferred<Consent?>()
            pending?.complete(null)
            pending = deferred
            context.startActivity(Intent(context, ProjectionConsentActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return deferred.await()
        }
    }
}
