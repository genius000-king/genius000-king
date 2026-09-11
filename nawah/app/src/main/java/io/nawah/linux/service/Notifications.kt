package io.nawah.linux.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import io.nawah.linux.MainActivity
import io.nawah.linux.R

/**
 * The two notifications the app posts. Both belong to foreground services, so
 * they are not optional decoration -- without them the work is killed.
 */
internal object Notifications {

    const val CHANNEL_INSTALL = "install"
    const val CHANNEL_SESSION = "session"

    const val ID_INSTALL = 1001
    const val ID_SESSION = 1002

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_INSTALL,
                context.getString(R.string.channel_install),
                // Installing takes 10-25 minutes; a sound every progress tick
                // would be intolerable, but the user must still see it.
                NotificationManager.IMPORTANCE_LOW,
            ).apply { setShowBadge(false) },
        )
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_SESSION,
                context.getString(R.string.channel_session),
                NotificationManager.IMPORTANCE_LOW,
            ).apply { setShowBadge(false) },
        )
    }

    fun install(context: Context, title: String, text: String, percent: Int?): Notification =
        base(context, CHANNEL_INSTALL, title, text)
            .apply {
                if (percent != null) setProgress(100, percent.coerceIn(0, 100), false)
                else setProgress(0, 0, true)
            }
            .build()

    fun session(context: Context, machineName: String, stopIntent: PendingIntent): Notification =
        base(context, CHANNEL_SESSION, machineName, context.getString(R.string.session_running))
            .addAction(0, context.getString(R.string.action_stop), stopIntent)
            .setOngoing(true)
            .build()

    private fun base(
        context: Context,
        channel: String,
        title: String,
        text: String,
    ): NotificationCompat.Builder {
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
    }
}
