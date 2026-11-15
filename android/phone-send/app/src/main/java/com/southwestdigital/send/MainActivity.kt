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
import android.provider.OpenableColumns
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
            textSize = 22f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply { setColor(ink); cornerRadius = 24 * dp }
            minHeight = (resources.displayMetrics.heightPixels * 0.35).toInt()
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
        val items = uris.mapNotNull { uri ->
            // Keep read access after the picker closes, so a long upload can carry on.
            try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (e: SecurityException) {}
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) Item(uri.toString(), c.getString(0) ?: "file", c.getLong(1)) else null
            }
        }
        val id = java.lang.Long.toString(System.currentTimeMillis(), 36) + "-" + java.util.UUID.randomUUID().toString().take(6)
        Store.put(this, Batch(id, System.currentTimeMillis(), items = items.toMutableList()))
        UploadWorker.start(this, id)
        render()
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
                "paused" -> "Paused at $pct% — $done of ${b.items.size} arrived"
                "sent" -> "All ${b.items.size} arrived"
                "failed" -> "$done of ${b.items.size} arrived"
                else -> "Sending — $done of ${b.items.size} arrived, $pct%"
            }
            card.addView(text(head, if (b.state == "failed") bad else ink, 17f, bold = true))
            if (b.message.isNotEmpty()) card.addView(text(b.message, if (b.state == "failed") bad else muted, 14f))
            for (item in b.items) {
                val (label, color) = when (item.state) {
                    "arrived" -> "arrived" to good
                    "reused" -> "already on ripley, not sent again" to good
                    "failed" -> ("not sent: " + item.error) to bad
                    "sending" -> "${(100 * item.sent / item.size.coerceAtLeast(1)).toInt()}%" to ink
                    else -> "waiting" to muted
                }
                card.addView(text("${item.name} — $label", color, 14f))
            }
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
