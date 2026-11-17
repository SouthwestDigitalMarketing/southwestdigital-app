package com.southwestdigital.send

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.FileProvider
import com.google.androidbrowserhelper.trusted.LauncherActivity
import java.io.File
import kotlin.concurrent.thread

/**
 * What SWapp shows first: its name and version, then whether ripley has a newer one.
 * Up to date (or ripley out of reach) carries on into SWapp; a newer version waits for Update or Later.
 */
class SplashActivity : Activity() {
    private val ui = Handler(Looper.getMainLooper())
    private lateinit var status: TextView
    private lateinit var buttons: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // New client reports arrive as phone notifications (Tom, 2026-11-17).
        ReportWatchWorker.schedule(this)
        if (android.os.Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 3)
        val dp = resources.displayMetrics.density
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0F172A"))
            setPadding((32 * dp).toInt(), 0, (32 * dp).toInt(), 0)
        }
        root.addView(android.widget.ImageView(this).apply {
            setImageResource(R.drawable.swdm_logo)
            adjustViewBounds = true
        }, LinearLayout.LayoutParams((96 * dp).toInt(), (96 * dp).toInt()).apply { bottomMargin = (20 * dp).toInt() })
        root.addView(TextView(this).apply {
            text = "SWapp"
            textSize = 40f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = "Version ${BuildConfig.VERSION_NAME}"
            textSize = 16f
            setTextColor(Color.parseColor("#CBD5E1"))
            gravity = Gravity.CENTER
        })
        status = TextView(this).apply {
            text = "Checking for updates…"
            textSize = 16f
            setTextColor(Color.parseColor("#CBD5E1"))
            gravity = Gravity.CENTER
            setPadding(0, (24 * dp).toInt(), 0, 0)
        }
        root.addView(status)
        buttons = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(0, (16 * dp).toInt(), 0, 0)
        }
        root.addView(buttons)
        setContentView(root)
        thread { check() }
    }

    private fun check() {
        val latest = try { Ripley.latestApp() } catch (e: Exception) { null }
        val newest = latest?.optInt("versionCode", 0) ?: 0
        ui.post {
            when {
                latest == null -> { status.text = "Could not reach ripley to check. Is Tailscale on?"; enterSoon(1800) }
                newest > BuildConfig.VERSION_CODE -> offer(latest.optString("versionName", "new"))
                else -> { status.text = "Up to date"; enterSoon(900) }
            }
        }
    }

    private fun offer(name: String) {
        status.text = "Update available: version $name"
        buttons.addView(button("Update", true) { update() })
        buttons.addView(button("Later", false) { enter() })
    }

    private fun update() {
        buttons.removeAllViews()
        status.text = "Downloading the update…"
        thread {
            try {
                val file = File(cacheDir, "updates").apply { mkdirs() }.let { File(it, "swapp.apk") }
                Ripley.downloadApp(file)
                val uri = FileProvider.getUriForFile(this, "$packageName.updates", file)
                ui.post {
                    status.text = "Installing…"
                    // Android shows its own install screen; the first time it asks to allow SWapp to install apps.
                    startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
                }
            } catch (e: Exception) {
                ui.post {
                    status.text = "The update did not download: ${e.message}"
                    buttons.addView(button("Try again", true) { update() })
                    buttons.addView(button("Later", false) { enter() })
                }
            }
        }
    }

    private fun enterSoon(ms: Long) = ui.postDelayed({ enter() }, ms)

    private fun enter() {
        if (isFinishing) return
        // NEW_TASK matters: without it the launcher restarts itself in the splash's closing task and never opens Chrome.
        startActivity(Intent(this, LauncherActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    private fun button(label: String, primary: Boolean, onClick: () -> Unit) = Button(this).apply {
        val dp = resources.displayMetrics.density
        text = label
        isAllCaps = false
        textSize = 17f
        setTextColor(if (primary) Color.parseColor("#0F172A") else Color.WHITE)
        background = GradientDrawable().apply {
            setColor(if (primary) Color.WHITE else Color.TRANSPARENT)
            setStroke((1 * dp).toInt(), Color.WHITE)
            cornerRadius = 999f
        }
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = (10 * dp).toInt() }
        setOnClickListener { onClick() }
    }
}
