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
    fun status(batch: String, name: String, size: Long, count: Int, head: String): JSONObject =
        call("GET", url("/upload-status", mapOf("batch" to batch, "name" to name, "size" to size, "count" to count,
            "head" to head))).second

    /** Send one piece; returns how many bytes ripley now has and whether the file is done. */
    fun piece(batch: String, name: String, size: Long, count: Int, offset: Long, data: ByteArray, length: Int): JSONObject {
        val params = mapOf("batch" to batch, "name" to name, "size" to size, "count" to count, "offset" to offset)
        return call("PUT", url("/upload", params), data, length).second
    }

    /** What ripley is doing with each recent video: its steps, the render bars, and the link once published. */
    fun videos(): org.json.JSONArray {
        val query = "exp=" + URLEncoder.encode(BuildConfig.SEND_EXP, "UTF-8") + "&sig=" + URLEncoder.encode(BuildConfig.SEND_SIG, "UTF-8")
        val (_, json) = call("GET", URL(BuildConfig.RIPLEY_URL.trimEnd('/') + "/status.json?" + query))
        return json.optJSONArray("videos") ?: org.json.JSONArray()
    }

    /** Throw away a half-sent batch on ripley. */
    fun cancel(batch: String) {
        call("POST", url("/cancel", mapOf("batch" to batch)), ByteArray(0), 0)
    }
}
