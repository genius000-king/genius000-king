package com.genius.saraat.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/** uid used for device-wide totals when no per-app attribution is available (limit is off). */
const val UID_DEVICE = -2

/** One usage record: bytes moved during one minute by one app on one kind of network. */
class UsageRow(
    val minute: Long,
    val uid: Int,
    /** 0 = Wi-Fi / other, 1 = mobile data. */
    val net: Int,
    val down: Long,
    val up: Long,
)

class MinuteTotal(val minute: Long, val down: Long, val up: Long)
class AppTotal(val uid: Int, val down: Long, val up: Long) {
    val total get() = down + up
}

class NetTotals(val wifiDown: Long, val wifiUp: Long, val mobileDown: Long, val mobileUp: Long)

/**
 * Plain SQLite store, one row per (minute, app, network). A minute is "epoch milliseconds / 60000".
 * Writes are batched by the service; reads happen on a background dispatcher in the UI.
 */
class UsageDb private constructor(context: Context) : SQLiteOpenHelper(context, "usage.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE usage(
                minute INTEGER NOT NULL, uid INTEGER NOT NULL, net INTEGER NOT NULL,
                down INTEGER NOT NULL, up INTEGER NOT NULL,
                PRIMARY KEY(minute, uid, net)) WITHOUT ROWID""",
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    @Synchronized
    fun add(rows: Collection<UsageRow>) {
        if (rows.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            val insert = db.compileStatement("INSERT OR IGNORE INTO usage(minute,uid,net,down,up) VALUES(?,?,?,0,0)")
            val update = db.compileStatement("UPDATE usage SET down=down+?, up=up+? WHERE minute=? AND uid=? AND net=?")
            for (r in rows) {
                insert.bindLong(1, r.minute); insert.bindLong(2, r.uid.toLong()); insert.bindLong(3, r.net.toLong())
                insert.executeInsert()
                update.bindLong(1, r.down); update.bindLong(2, r.up)
                update.bindLong(3, r.minute); update.bindLong(4, r.uid.toLong()); update.bindLong(5, r.net.toLong())
                update.executeUpdateDelete()
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    /** All apps and networks summed per minute. */
    @Synchronized
    fun perMinute(fromMinute: Long, toMinute: Long): List<MinuteTotal> {
        val out = ArrayList<MinuteTotal>()
        readableDatabase.rawQuery(
            "SELECT minute, SUM(down), SUM(up) FROM usage WHERE minute>=? AND minute<? GROUP BY minute ORDER BY minute",
            arrayOf(fromMinute.toString(), toMinute.toString()),
        ).use { c -> while (c.moveToNext()) out += MinuteTotal(c.getLong(0), c.getLong(1), c.getLong(2)) }
        return out
    }

    @Synchronized
    fun perApp(fromMinute: Long, toMinute: Long, limit: Int = 30): List<AppTotal> {
        val out = ArrayList<AppTotal>()
        readableDatabase.rawQuery(
            """SELECT uid, SUM(down), SUM(up) FROM usage WHERE minute>=? AND minute<? AND uid<>$UID_DEVICE
               GROUP BY uid ORDER BY SUM(down)+SUM(up) DESC LIMIT $limit""",
            arrayOf(fromMinute.toString(), toMinute.toString()),
        ).use { c -> while (c.moveToNext()) out += AppTotal(c.getInt(0), c.getLong(1), c.getLong(2)) }
        return out
    }

    @Synchronized
    fun perNetwork(fromMinute: Long, toMinute: Long): NetTotals {
        var wd = 0L; var wu = 0L; var md = 0L; var mu = 0L
        readableDatabase.rawQuery(
            "SELECT net, SUM(down), SUM(up) FROM usage WHERE minute>=? AND minute<? GROUP BY net",
            arrayOf(fromMinute.toString(), toMinute.toString()),
        ).use { c ->
            while (c.moveToNext()) {
                if (c.getInt(0) == 1) { md = c.getLong(1); mu = c.getLong(2) } else { wd = c.getLong(1); wu = c.getLong(2) }
            }
        }
        return NetTotals(wd, wu, md, mu)
    }

    /** Streams every row in range (for CSV export). */
    @Synchronized
    fun forEachRow(fromMinute: Long, toMinute: Long, action: (UsageRow) -> Unit) {
        readableDatabase.rawQuery(
            "SELECT minute, uid, net, down, up FROM usage WHERE minute>=? AND minute<? ORDER BY minute, uid",
            arrayOf(fromMinute.toString(), toMinute.toString()),
        ).use { c ->
            while (c.moveToNext()) action(UsageRow(c.getLong(0), c.getInt(1), c.getInt(2), c.getLong(3), c.getLong(4)))
        }
    }

    @Synchronized
    fun prune(beforeMinute: Long) {
        writableDatabase.delete("usage", "minute<?", arrayOf(beforeMinute.toString()))
    }

    @Synchronized
    fun clear() {
        writableDatabase.delete("usage", null, null)
    }

    companion object {
        @Volatile
        private var instance: UsageDb? = null

        fun get(context: Context): UsageDb =
            instance ?: synchronized(this) {
                instance ?: UsageDb(context.applicationContext).also { instance = it }
            }
    }
}
