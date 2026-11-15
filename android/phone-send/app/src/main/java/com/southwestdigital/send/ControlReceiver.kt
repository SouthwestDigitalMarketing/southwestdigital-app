package com.southwestdigital.send

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlin.concurrent.thread

/** Pause, resume and cancel, from the notification or the app. */
class ControlReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val batch = intent.getStringExtra("batch") ?: return
        val pending = goAsync()
        thread {
            try {
                act(context, intent.action ?: "", batch)
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        fun intent(context: Context, action: String, batch: String): PendingIntent {
            val i = Intent(context, ControlReceiver::class.java).setAction(action).putExtra("batch", batch)
            return PendingIntent.getBroadcast(context, (action + batch).hashCode(), i,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        /** Runs off the main thread: cancel talks to ripley. */
        fun act(context: Context, action: String, batch: String) {
            when (action) {
                "pause" -> {
                    Store.update(context, batch) { it.state = "paused"; it.message = "" }
                    UploadWorker.stop(context, batch)
                }
                "resume" -> {
                    Store.update(context, batch) { b ->
                        b.state = "sending"
                        b.items.filter { it.state == "failed" }.forEach { it.state = "waiting"; it.error = "" }
                    }
                    UploadWorker.start(context, batch)
                }
                "cancel" -> {
                    UploadWorker.stop(context, batch)
                    try {
                        Ripley.cancel(batch)
                    } catch (e: Exception) {
                        // ripley may be out of reach; an unfinished batch never becomes a video anyway.
                    }
                    Store.remove(context, batch)
                }
            }
        }
    }
}
