package com.southwestdigital.send

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.media.MediaMetadataRetriever
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.text.format.DateUtils
import android.text.format.Formatter
import android.widget.ProgressBar
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import kotlin.concurrent.thread

/** One big button to pick, and a list of what is still on its way to ripley. */
class MainActivity : Activity() {
    private val pick = 1
    private val ui = Handler(Looper.getMainLooper())
    private lateinit var list: LinearLayout
    private val tick = object : Runnable {
        override fun run() {
            render()
            ui.postDelayed(this, 1000)
        }
    }

    private val ink = Color.parseColor("#0F172A")
    private val muted = Color.parseColor("#64748B")
    private val bad = Color.parseColor("#BE123C")
    private val good = Color.parseColor("#15803D")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val dp = resources.displayMetrics.density
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding((20 * dp).toInt(), (48 * dp).toInt(), (20 * dp).toInt(), (24 * dp).toInt())
            setBackgroundColor(Color.parseColor("#F8FAFC"))
        }
        val choose = Button(this).apply {
            text = "Choose videos and pictures"
            textSize = 17f
            isAllCaps = false
            setTextColor(Color.WHITE)
            // An ordinary button, like the send page's (Tom, 2026-11-15).
            background = GradientDrawable().apply { setColor(ink); cornerRadius = 999f }
            setPadding((24 * dp).toInt(), (14 * dp).toInt(), (24 * dp).toInt(), (14 * dp).toInt())
            layoutParams = LinearLayout.LayoutParams(-2, -2)
            setOnClickListener { openPicker() }
        }
        root.addView(choose)
        root.addView(text("Pick everything for one video at once. You can leave the app; it keeps sending.", muted, 15f).apply {
            setPadding(0, (12 * dp).toInt(), 0, (8 * dp).toInt())
        })
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(list)
        setContentView(ScrollView(this).apply { addView(root) })
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2)
        if (BuildConfig.RIPLEY_URL.isEmpty()) choose.isEnabled = false
        handle(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** SWapp's My phone button opens swappsend://pick: go straight to the picker. */
    private fun handle(intent: Intent?) {
        if (intent?.data?.scheme == "swappsend") {
            intent.data = null
            openPicker()
        }
    }

    override fun onResume() {
        super.onResume()
        ui.post(tick)
    }

    override fun onPause() {
        super.onPause()
        ui.removeCallbacks(tick)
    }

    private fun openPicker() {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("video/*", "image/*"))
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        startActivityForResult(i, pick)
    }

    @Deprecated("Activity result API kept simple on purpose")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != pick || resultCode != RESULT_OK || data == null) return
        val uris = mutableListOf<Uri>()
        data.clipData?.let { clip -> for (n in 0 until clip.itemCount) uris.add(clip.getItemAt(n).uri) }
        if (uris.isEmpty()) data.data?.let { uris.add(it) }
        if (uris.isEmpty()) return
        // Reading each video's length and date takes a moment; keep it off the screen's thread.
        thread {
            val items = uris.mapNotNull { uri -> describe(uri) }
            val id = java.lang.Long.toString(System.currentTimeMillis(), 36) + "-" + java.util.UUID.randomUUID().toString().take(6)
            Store.put(this, Batch(id, System.currentTimeMillis(), items = items.toMutableList()))
            UploadWorker.start(this, id)
            runOnUiThread { render() }
        }
    }

    /** Name, size, video length and recorded date of one picked file. */
    private fun describe(uri: Uri): Item? {
        // Keep read access after the picker closes, so a long upload can carry on.
        try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (e: SecurityException) {}
        var modified = 0L
        val base = contentResolver.query(uri, null, null, null, null)?.use { c ->
            if (!c.moveToFirst()) return@use null
            val name = c.getString(c.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME)) ?: "file"
            val size = c.getLong(c.getColumnIndexOrThrow(OpenableColumns.SIZE))
            val m = c.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
            if (m >= 0) modified = c.getLong(m)
            name to size
        } ?: return null
        var duration = -1L
        var taken = 0L
        val type = contentResolver.getType(uri) ?: ""
        if (type.startsWith("video/")) {
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(this, uri)
                duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: -1
                taken = recorded(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE))
            } catch (e: Exception) {
            } finally {
                retriever.release()
            }
        }
        return Item(uri.toString(), base.first, base.second, duration = duration, taken = if (taken > 0) taken else modified)
    }

    /** The video's own "recorded" stamp, e.g. 20261115T192514.000Z. */
    private fun recorded(stamp: String?): Long {
        if (stamp.isNullOrBlank()) return 0
        for (pattern in listOf("yyyyMMdd'T'HHmmss.SSS'Z'", "yyyyMMdd'T'HHmmss'Z'")) {
            try {
                val format = java.text.SimpleDateFormat(pattern, java.util.Locale.US)
                format.timeZone = java.util.TimeZone.getTimeZone("UTC")
                val time = format.parse(stamp)?.time ?: 0
                // Some phones write 1904 or 1970 when they have no date.
                if (time > 946684800000L) return time
            } catch (e: Exception) {}
        }
        return 0
    }

    private fun render() {
        list.removeAllViews()
        val dp = resources.displayMetrics.density
        for (b in Store.all(this)) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding((14 * dp).toInt(), (12 * dp).toInt(), (14 * dp).toInt(), (12 * dp).toInt())
                background = GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = 12 * dp; setStroke(1, Color.parseColor("#E2E8F0")) }
                layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = (10 * dp).toInt() }
            }
            val done = b.items.count { it.state == "arrived" || it.state == "reused" }
            val total = b.items.sumOf { it.size }.coerceAtLeast(1)
            val pct = (100 * b.items.sumOf { it.sent } / total).toInt()
            val head = when (b.state) {
                "paused" -> "Paused — $done of ${b.items.size} arrived"
                "sent" -> "All ${b.items.size} arrived"
                "failed" -> "$done of ${b.items.size} arrived"
                else -> "Sending — $done of ${b.items.size} arrived"
            }
            card.addView(text(head, if (b.state == "failed") bad else ink, 17f, bold = true))
            if (b.message.isNotEmpty()) card.addView(text(b.message, if (b.state == "failed") bad else muted, 14f))
            if (b.state != "sent") {
                // The whole video first, then the connection it is going over, then each file.
                val overall = if (b.state == "paused") "paused" else batchLeft(b)
                card.addView(barRow(pct, "$pct%  ·  $overall", ink, dp))
                card.addView(text(connection(b), muted, 13f).apply { setPadding(0, (4 * dp).toInt(), 0, 0) })
            }
            for (item in b.items) card.addView(fileRows(item, b.state, dp))
            if (b.state != "sent") {
                val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, (8 * dp).toInt(), 0, 0) }
                val paused = b.state == "paused" || b.state == "failed"
                row.addView(button(if (paused) "Resume" else "Pause") { control(if (paused) "resume" else "pause", b.id) })
                row.addView(button("Cancel") {
                    AlertDialog.Builder(this).setMessage("Stop sending this video? What arrived so far is thrown away.")
                        .setPositiveButton("Stop sending") { _, _ -> control("cancel", b.id) }
                        .setNegativeButton("Keep sending", null).show()
                })
                card.addView(row)
            } else {
                card.addView(button("Remove from list") { Store.remove(this, b.id); render() }.apply {
                    layoutParams = LinearLayout.LayoutParams(-2, -2).apply { topMargin = (8 * dp).toInt() }
                })
            }
            list.addView(card)
        }
    }

    /** Three rows per file: its name; size, length and recorded date; a bar with percent and time left. */
    private fun fileRows(item: Item, batchState: String, dp: Float): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, (10 * dp).toInt(), 0, 0)
        }
        box.addView(text(item.name, ink, 15f, bold = true))
        val meta = mutableListOf(Formatter.formatShortFileSize(this, item.size))
        if (item.duration >= 0) meta.add(DateUtils.formatElapsedTime(item.duration / 1000))
        if (item.taken > 0) meta.add(DateUtils.formatDateTime(this, item.taken,
            DateUtils.FORMAT_SHOW_DATE or DateUtils.FORMAT_SHOW_TIME or DateUtils.FORMAT_ABBREV_MONTH))
        box.addView(text(meta.joinToString("  ·  "), muted, 13f))
        val pct = (100 * item.sent / item.size.coerceAtLeast(1)).toInt().coerceIn(0, 100)
        val (label, color) = when (item.state) {
            "arrived" -> "100%  ·  arrived" to good
            "reused" -> "already on ripley" to good
            "failed" -> ("not sent: " + item.error) to bad
            "sending" -> "$pct%  ·  " + (if (batchState == "paused") "paused" else left(item)) to ink
            else -> (if (pct > 0) "$pct%  ·  waiting" else "waiting") to muted
        }
        box.addView(barRow(if (item.state == "arrived" || item.state == "reused") 100 else pct, label, color, dp))
        return box
    }

    /** A progress bar with its words (percent, time left) beside it. */
    private fun barRow(pct: Int, label: String, color: Int, dp: Float): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, (4 * dp).toInt(), 0, 0)
        }
        row.addView(ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = pct
            layoutParams = LinearLayout.LayoutParams(0, (8 * dp).toInt(), 1f)
        })
        row.addView(text(label, color, 13f).apply { setPadding((10 * dp).toInt(), 0, 0, 0) })
        return row
    }

    /** Time left for the whole video at the current speed. */
    private fun batchLeft(b: Batch): String {
        val rate = b.items.firstOrNull { it.state == "sending" }?.rate ?: b.items.maxOfOrNull { it.rate } ?: 0.0
        if (rate <= 0) return "working out time left"
        val remaining = b.items.filter { it.state != "arrived" && it.state != "reused" }.sumOf { it.size - it.sent }
        return duration((remaining / rate).toLong())
    }

    /** Wi-Fi or mobile data, through Tailscale or not, and how fast it is sending right now. */
    private fun connection(b: Batch): String {
        val manager = getSystemService(ConnectivityManager::class.java)
        val caps = manager.getNetworkCapabilities(manager.activeNetwork)
        val parts = mutableListOf<String>()
        when {
            caps == null -> parts.add("No connection")
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> parts.add("Wi-Fi")
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> parts.add("Mobile data")
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> parts.add("Wired")
            else -> parts.add("Connected")
        }
        // Tailscale shows up as a VPN; without it ripley cannot be reached.
        if (caps != null) parts.add(if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) "Tailscale on" else "Tailscale off?")
        val rate = b.items.firstOrNull { it.state == "sending" }?.rate ?: 0.0
        if (rate > 0 && b.state == "sending") {
            parts.add(Formatter.formatShortFileSize(this, rate.toLong()) + "/s (" + "%.0f".format(rate * 8 / 1_000_000) + " Mbps)")
        }
        return parts.joinToString("  ·  ")
    }

    /** Time left for this file at its recent speed. */
    private fun left(item: Item): String {
        if (item.rate <= 0) return "working out time left"
        return duration(((item.size - item.sent) / item.rate).toLong())
    }

    private fun duration(seconds: Long): String {
        return when {
            seconds < 60 -> "under a minute left"
            seconds < 3600 -> "about ${(seconds + 30) / 60} min left"
            else -> "about ${seconds / 3600} h ${(seconds % 3600) / 60} min left"
        }
    }

    private fun control(action: String, batch: String) {
        thread { ControlReceiver.act(this, action, batch); runOnUiThread { render() } }
    }

    private fun text(value: String, color: Int, size: Float, bold: Boolean = false) = TextView(this).apply {
        text = value
        setTextColor(color)
        textSize = size
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        gravity = Gravity.CENTER
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(0, -2, 1f).apply { marginEnd = 8 }
        visibility = View.VISIBLE
    }
}
