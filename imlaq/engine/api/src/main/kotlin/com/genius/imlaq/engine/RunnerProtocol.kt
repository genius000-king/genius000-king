package com.genius.imlaq.engine

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull

/**
 * The wire format every runner process speaks (docs/PROTOCOL.md):
 *
 *  - stdin:  one JSON object per line — `{"cmd":"generate","id":1,...}`
 *  - stdout: one event per line — `<PREFIX>_<EVENT> {json}`; any other line is a log line.
 *
 * BigMoeOnEdge's `bmoe-cli` already speaks this shape with the prefix `BMOE`; our own runners
 * use `IMQ`. One parser serves both.
 */
data class RunnerEvent(val name: String, val payload: JsonObject) {

    fun string(key: String): String? = (payload[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
    fun int(key: String): Int? = (payload[key] as? JsonPrimitive)?.intOrNull
    fun long(key: String): Long? = (payload[key] as? JsonPrimitive)?.longOrNull
    fun double(key: String): Double? = (payload[key] as? JsonPrimitive)?.doubleOrNull
    fun bool(key: String): Boolean? = (payload[key] as? JsonPrimitive)?.let {
        it.booleanOrNull ?: it.intOrNull?.let { n -> n != 0 }
    }
}

class RunnerLineParser(private val prefix: String) {

    private val tag = prefix + "_"

    /** Returns the event, or null for a log line (or a malformed event, which is logged as-is). */
    fun parse(line: String): RunnerEvent? {
        val t = line.trim()
        if (!t.startsWith(tag)) return null
        val space = t.indexOf(' ')
        val name = if (space < 0) t.substring(tag.length) else t.substring(tag.length, space)
        if (name.isEmpty() || !name.all { it.isUpperCase() || it == '_' || it.isDigit() }) return null
        val body = if (space < 0) "{}" else t.substring(space + 1).trim()
        val obj = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull() ?: return null
        return RunnerEvent(name, obj)
    }

    private companion object {
        val json = Json { isLenient = false }
    }
}
