package com.southwestdigital.send

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Every 15 minutes, asks ripley for the published client reports and posts a phone
 * notification for each one not seen before; tapping it opens the PDF. The first
 * check only remembers what is already there, so installing it does not flood.
 */
class ReportWatchWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val reports = try { Ripley.reports() } catch (e: Exception) { return Result.success() }
        val prefs = applicationContext.getSharedPreferences("reports", Context.MODE_PRIVATE)
        val seen = prefs.getStringSet("seen", emptySet())!!.toMutableSet()
        val primed = prefs.getBoolean("primed", false)
        for (i in 0 until reports.length()) {
            val report = reports.getJSONObject(i)
            val path = report.optString("path")
            if (path.isEmpty() || !seen.add(path)) continue
            if (primed) notify(report.optString("name"), report.optString("label"), path)
        }
        prefs.edit().putStringSet("seen", seen).putBoolean("primed", true).apply()
        return Result.success()
    }

    private fun notify(name: String, label: String, path: String) {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "New client reports", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(
            applicationContext, path.hashCode(),
            Intent(Intent.ACTION_VIEW, Uri.parse(Ripley.reportUrl(path))).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val note = NotificationCompat.Builder(applicationContext, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_agenda)
            .setContentTitle("New report: $name")
            .setContentText(label)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        manager.notify(path.hashCode(), note)
    }

    companion object {
        const val CHANNEL = "reports"

        /** Keeps one 15-minute check scheduled; calling it again changes nothing. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<ReportWatchWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("report-watch", ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}
