package com.southwestdigital.send

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** A refusal from ripley (4xx): sending again will not help. */
class Refused(message: String) : Exception(message)

/** The receiver on ripley: the same upload road the send page uses. */
object Ripley {
    const val CHUNK = 8 * 1024 * 1024

    private fun url(path: String, params: Map<String, Any>): URL {
        val all = mapOf("sexp" to BuildConfig.SEND_EXP, "ssig" to BuildConfig.SEND_SIG) + params
        val query = all.entries.joinToString("&") { (k, v) -> k + "=" + URLEncoder.encode(v.toString(), "UTF-8") }
        return URL(BuildConfig.RIPLEY_URL.trimEnd('/') + path + "?" + query)
    }

    private fun call(method: String, url: URL, body: ByteArray? = null, length: Int = 0): Pair<Int, JSONObject> {
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 20_000
            conn.readTimeout = 120_000
            if (body != null) {
                conn.doOutput = true
                conn.setFixedLengthStreamingMode(length)
                conn.outputStream.use { it.write(body, 0, length) }
            }
            val code = conn.responseCode
            val stream = if (code >= 400) conn.errorStream else conn.inputStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
            val json = try { JSONObject(text) } catch (e: Exception) { JSONObject() }
            if (code in 400..499 && code != 409) throw Refused(json.optString("error", "ripley refused it ($code)"))
            if (code >= 500) throw IOException("ripley had a problem ($code)")
            return code to json
        } finally {
            conn.disconnect()
        }
    }

    /**
     * How much of this file ripley has. ripley reuses a copy it already has (reused=true), matched by
     * size and [head], the SHA-256 of the first MiB, so a file renamed elsewhere is still recognised.
     */
    fun status(batch: String, name: String, size: Long, count: Int, head: String, options: Map<String, Any> = emptyMap()): JSONObject =
        call("GET", url("/upload-status", mapOf("batch" to batch, "name" to name, "size" to size, "count" to count,
            "head" to head) + options)).second

    /** Send one piece; returns how many bytes ripley now has and whether the file is done. */
    fun piece(batch: String, name: String, size: Long, count: Int, offset: Long, data: ByteArray, length: Int,
              options: Map<String, Any> = emptyMap()): JSONObject {
        val params = mapOf("batch" to batch, "name" to name, "size" to size, "count" to count, "offset" to offset) + options
        return call("PUT", url("/upload", params), data, length).second
    }

    /** What a batch tells ripley: the video it joins (Add more clips) and the Full auto switch. */
    fun options(batch: Batch): Map<String, Any> =
        (if (batch.addTo.isNotEmpty()) mapOf("addTo" to batch.addTo) else emptyMap<String, Any>()) +
            (if (batch.playlists.isNotEmpty()) mapOf("playlists" to batch.playlists.joinToString("|")) else emptyMap()) +
            mapOf("auto" to if (batch.auto) "1" else "0")

    /** The playlists to offer for a new video, from ripley (~/.config/showrunner/playlists.json). */
    fun playlists(): List<String> {
        val query = "exp=" + URLEncoder.encode(BuildConfig.SEND_EXP, "UTF-8") + "&sig=" + URLEncoder.encode(BuildConfig.SEND_SIG, "UTF-8")
        val (_, json) = call("GET", URL(BuildConfig.RIPLEY_URL.trimEnd('/') + "/playlists.json?" + query))
        val list = json.optJSONArray("playlists") ?: return emptyList()
        return List(list.length()) { list.getString(it) }
    }

    /** Finish (Tom, 2026-11-25): the waiting video may be built now; [note] is anything to change, or empty. */
    fun finish(batch: String, note: String) {
        call("POST", url("/finish", mapOf("batch" to batch, "note" to note)), ByteArray(0), 0)
    }

    /** What ripley is doing with each recent video: its steps, the render bars, and the link once published. */
    fun videos(): org.json.JSONArray {
        val query = "exp=" + URLEncoder.encode(BuildConfig.SEND_EXP, "UTF-8") + "&sig=" + URLEncoder.encode(BuildConfig.SEND_SIG, "UTF-8")
        val (_, json) = call("GET", URL(BuildConfig.RIPLEY_URL.trimEnd('/') + "/status.json?" + query))
        return json.optJSONArray("videos") ?: org.json.JSONArray()
    }

    /** Every published client report on ripley: client name, month label, and its path. */
    fun reports(): org.json.JSONArray {
        val query = "exp=" + URLEncoder.encode(BuildConfig.SEND_EXP, "UTF-8") + "&sig=" + URLEncoder.encode(BuildConfig.SEND_SIG, "UTF-8")
        val (_, json) = call("GET", URL(BuildConfig.RIPLEY_URL.trimEnd('/') + "/reports.json?" + query))
        return json.optJSONArray("reports") ?: org.json.JSONArray()
    }

    /** A report's address on ripley, signed so the phone can open it. */
    fun reportUrl(path: String): String =
        BuildConfig.RIPLEY_URL.trimEnd('/') + path + "?exp=" + URLEncoder.encode(BuildConfig.SEND_EXP, "UTF-8") +
            "&sig=" + URLEncoder.encode(BuildConfig.SEND_SIG, "UTF-8")

    /** The newest app ripley has: {"versionCode": n, "versionName": "x.y"}; empty if it cannot say. */
    fun latestApp(): JSONObject {
        val conn = URL(BuildConfig.RIPLEY_URL.trimEnd('/') + "/app/version").openConnection() as HttpURLConnection
        conn.connectTimeout = 4000
        conn.readTimeout = 4000
        return try {
            JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        } finally {
            conn.disconnect()
        }
    }

    /** Download the newest app into [target]. */
    fun downloadApp(target: java.io.File) {
        val query = "exp=" + URLEncoder.encode(BuildConfig.SEND_EXP, "UTF-8") + "&sig=" + URLEncoder.encode(BuildConfig.SEND_SIG, "UTF-8")
        val conn = URL(BuildConfig.RIPLEY_URL.trimEnd('/') + "/app.apk?" + query).openConnection() as HttpURLConnection
        conn.connectTimeout = 20_000
        conn.readTimeout = 120_000
        try {
            if (conn.responseCode != 200) throw IOException("ripley would not send the app (" + conn.responseCode + ")")
            conn.inputStream.use { input -> target.outputStream().use { input.copyTo(it) } }
        } finally {
            conn.disconnect()
        }
    }

    /** Throw away a half-sent batch on ripley. */
    fun cancel(batch: String) {
        call("POST", url("/cancel", mapOf("batch" to batch)), ByteArray(0), 0)
    }
}
