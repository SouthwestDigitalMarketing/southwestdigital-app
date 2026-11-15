package com.southwestdigital.send

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** One picked file and how far it got. */
data class Item(
    val uri: String,
    val name: String,
    val size: Long,
    var state: String = "waiting", // waiting, sending, arrived, reused, failed
    var sent: Long = 0,
    var error: String = "",
)

/** One pick is one batch on ripley, and one batch becomes one video. */
data class Batch(
    val id: String,
    val created: Long,
    var state: String = "sending", // sending, waiting, paused, sent, failed
    var message: String = "",
    val items: MutableList<Item> = mutableListOf(),
)

/** Batches kept in a small JSON file so uploads survive the app being closed. */
object Store {
    private val lock = Any()

    private fun file(context: Context) = File(context.filesDir, "batches.json")

    fun all(context: Context): List<Batch> = synchronized(lock) { read(context) }

    fun get(context: Context, id: String): Batch? = all(context).firstOrNull { it.id == id }

    fun put(context: Context, batch: Batch) = synchronized(lock) {
        val list = read(context).filter { it.id != batch.id }.toMutableList()
        list.add(0, batch)
        write(context, list)
    }

    fun update(context: Context, id: String, change: (Batch) -> Unit) = synchronized(lock) {
        val list = read(context)
        list.firstOrNull { it.id == id }?.let(change)
        write(context, list)
    }

    fun remove(context: Context, id: String) = synchronized(lock) {
        write(context, read(context).filter { it.id != id })
    }

    private fun read(context: Context): MutableList<Batch> {
        val f = file(context)
        if (!f.exists()) return mutableListOf()
        return try {
            val array = JSONArray(f.readText())
            MutableList(array.length()) { i -> batchOf(array.getJSONObject(i)) }
        } catch (e: Exception) {
            mutableListOf()
        }
    }

    private fun write(context: Context, list: List<Batch>) {
        val array = JSONArray()
        // Keep the newest 20; finished ones older than that are history Tom does not need.
        list.take(20).forEach { array.put(jsonOf(it)) }
        val tmp = File(context.filesDir, "batches.json.tmp")
        tmp.writeText(array.toString())
        tmp.renameTo(file(context))
    }

    private fun batchOf(o: JSONObject): Batch {
        val items = o.getJSONArray("items")
        return Batch(
            o.getString("id"), o.getLong("created"), o.optString("state"), o.optString("message"),
            MutableList(items.length()) { i ->
                val it = items.getJSONObject(i)
                Item(it.getString("uri"), it.getString("name"), it.getLong("size"), it.optString("state"),
                    it.optLong("sent"), it.optString("error"))
            },
        )
    }

    private fun jsonOf(b: Batch): JSONObject {
        val items = JSONArray()
        b.items.forEach {
            items.put(JSONObject().put("uri", it.uri).put("name", it.name).put("size", it.size)
                .put("state", it.state).put("sent", it.sent).put("error", it.error))
        }
        return JSONObject().put("id", b.id).put("created", b.created).put("state", b.state)
            .put("message", b.message).put("items", items)
    }
}
