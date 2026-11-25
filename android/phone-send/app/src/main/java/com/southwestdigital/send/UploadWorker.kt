package com.southwestdigital.send

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import java.io.FileInputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** Sends one batch to ripley in 8 MiB pieces, in the background, picking up where it stopped. */
class UploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val id get() = inputData.getString("batch") ?: ""

    override suspend fun doWork(): Result {
        val batch = Store.get(applicationContext, id) ?: return Result.success()
        if (batch.state == "paused") return Result.success()
        Store.update(applicationContext, id) { it.state = "sending"; it.message = "" }
        setForeground(foregroundInfo(batch))
        val count = batch.items.size
        for (item in batch.items) {
            if (item.state == "arrived" || item.state == "reused" || item.state == "failed") continue
            try {
                send(item, count, Ripley.options(batch))
            } catch (e: Refused) {
                mark(item) { it.state = "failed"; it.error = e.message ?: "refused" }
            } catch (e: IOException) {
                if (isStopped) return Result.success()
                Store.update(applicationContext, id) { it.state = "waiting"; it.message = "Lost the connection. Trying again by itself." }
                return Result.retry()
            } catch (e: SecurityException) {
                mark(item) { it.state = "failed"; it.error = "The phone no longer lets the app read this file. Choose it again." }
            }
            if (isStopped) return Result.success()
        }
        val failed = Store.get(applicationContext, id)?.items?.count { it.state == "failed" } ?: 0
        Store.update(applicationContext, id) {
            it.state = if (failed > 0) "failed" else "sent"
            it.message = if (failed > 0) "$failed file(s) were not sent." else "All sent. ripley is making the video."
        }
        return Result.success()
    }

    private suspend fun send(item: Item, count: Int, options: Map<String, Any>) {
        val start = Ripley.status(id, item.name, item.size, count, head(item), options)
        if (start.optBoolean("done")) {
            mark(item) { it.state = if (start.optBoolean("reused")) "reused" else "arrived"; it.sent = item.size }
            return
        }
        var received = start.optLong("received")
        mark(item) { it.state = "sending"; it.sent = received }
        val buffer = ByteArray(Ripley.CHUNK)
        applicationContext.contentResolver.openFileDescriptor(Uri.parse(item.uri), "r").use { fd ->
            FileInputStream(fd!!.fileDescriptor).use { input ->
                val channel = input.channel
                while (received < item.size) {
                    if (isStopped) return
                    channel.position(received)
                    val want = minOf(Ripley.CHUNK.toLong(), item.size - received).toInt()
                    var got = 0
                    while (got < want) {
                        val n = input.read(buffer, got, want - got)
                        if (n < 0) break
                        got += n
                    }
                    if (got != want) throw Refused("The file changed size on the phone.")
                    val began = System.nanoTime()
                    val reply = Ripley.piece(id, item.name, item.size, count, received, buffer, got, options)
                    val seconds = (System.nanoTime() - began) / 1e9
                    received = if (reply.optBoolean("done")) item.size else reply.optLong("received", received)
                    // A smoothed speed, so the time left does not jump with every piece.
                    val now = if (seconds > 0) got / seconds else 0.0
                    mark(item) { it.sent = received; it.rate = if (it.rate > 0) it.rate * 0.7 + now * 0.3 else now }
                    setForeground(foregroundInfo(Store.get(applicationContext, id) ?: return))
                }
            }
        }
        mark(item) { it.state = "arrived"; it.sent = item.size }
    }

    /** SHA-256 of the first MiB: with the size, enough for ripley to spot a file it already has. */
    private fun head(item: Item): String {
        val digest = MessageDigest.getInstance("SHA-256")
        applicationContext.contentResolver.openInputStream(Uri.parse(item.uri)).use { input ->
            val buffer = ByteArray(1024 * 1024)
            var got = 0
            while (got < buffer.size) {
                val n = input!!.read(buffer, got, buffer.size - got)
                if (n < 0) break
                got += n
            }
            digest.update(buffer, 0, got)
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun mark(item: Item, change: (Item) -> Unit) {
        change(item)
        Store.update(applicationContext, id) { b -> b.items.firstOrNull { it.uri == item.uri }?.let(change) }
    }

    override suspend fun getForegroundInfo(): ForegroundInfo =
        foregroundInfo(Store.get(applicationContext, id) ?: Batch(id, 0))

    private fun foregroundInfo(batch: Batch): ForegroundInfo {
        val note = progressNotification(applicationContext, batch)
        val code = id.hashCode()
        return if (Build.VERSION.SDK_INT >= 29) {
            ForegroundInfo(code, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(code, note)
        }
    }

    companion object {
        const val CHANNEL = "uploads"

        fun start(context: Context, batch: String) {
            val request = OneTimeWorkRequestBuilder<UploadWorker>()
                .setInputData(workDataOf("batch" to batch))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(batch, ExistingWorkPolicy.REPLACE, request)
        }

        fun stop(context: Context, batch: String) {
            WorkManager.getInstance(context).cancelUniqueWork(batch)
            context.getSystemService(NotificationManager::class.java).cancel(batch.hashCode())
        }

        fun progressNotification(context: Context, batch: Batch): Notification {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Uploads to ripley", NotificationManager.IMPORTANCE_LOW))
            val total = batch.items.sumOf { it.size }.coerceAtLeast(1)
            val sent = batch.items.sumOf { it.sent }
            val done = batch.items.count { it.state == "arrived" || it.state == "reused" }
            val pct = (100 * sent / total).toInt()
            val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
            return NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle("Sending to ripley: $done of ${batch.items.size} files")
                .setContentText("$pct% sent")
                .setProgress(100, pct, false)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(open)
                .addAction(0, "Pause", ControlReceiver.intent(context, "pause", batch.id))
                .addAction(0, "Cancel", ControlReceiver.intent(context, "cancel", batch.id))
                .build()
        }
    }
}
