package com.resonantsystems.bighartbeat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.IBinder

/**
 * mediaPlayback foreground service backing transport-driven background audio.
 *
 * Its only job is to keep the app process foreground-privileged so the
 * WebView's JS scheduler isn't frozen with the screen off. Audio itself stays
 * entirely inside the WebView's Web Audio graph. Started/stopped by
 * MainActivity when the bridge reports S.playing transitions (ADR-002 §4).
 */
class PlaybackService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            MainActivity.active?.stopBackgroundAudioFromNotification()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        createChannel()
        startForeground(NOTIF_ID, buildNotification())
        return START_STICKY
    }

    private fun createChannel() {
        val ch = NotificationChannel(
            CHANNEL_ID, "Background audio", NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Keeps Bighart Beat playing with the screen off" }
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        val stop = PendingIntent.getService(
            this, 1,
            Intent(this, PlaybackService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("Bighart Beat")
            .setContentText("Beat running — audio active in background")
            .setContentIntent(open)
            .addAction(Notification.Action.Builder(null as Icon?, "STOP", stop).build())
            .setOngoing(true)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "playback"
        const val NOTIF_ID = 1
        const val ACTION_STOP = "com.resonantsystems.bighartbeat.STOP_BG"
    }
}
