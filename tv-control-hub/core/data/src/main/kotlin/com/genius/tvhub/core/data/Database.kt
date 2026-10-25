package com.genius.tvhub.core.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

/** TV side: a phone allowed to connect, with its grants as a bitmask. */
@Entity(tableName = "trusted_device")
data class TrustedDeviceEntity(
    @PrimaryKey val id: String,
    val name: String,
    val model: String,
    val publicKey: ByteArray,
    val grants: Int,
    val pairedAt: Long,
    val lastSeenAt: Long,
)

/** Phone side: a TV paired with, and where it was last seen. */
@Entity(tableName = "paired_tv")
data class PairedTvEntity(
    @PrimaryKey val id: String,
    val name: String,
    val publicKey: ByteArray,
    val host: String,
    val port: Int,
    val pairedAt: Long,
    val lastConnectedAt: Long,
)

/** TV side: a Termux service definition. */
@Entity(tableName = "service")
data class ServiceEntity(
    @PrimaryKey val id: String,
    val name: String,
    val kind: String,
    val workdir: String,
    val command: String,
    val autoStart: Boolean,
)

@Dao
interface TrustedDeviceDao {
    @Query("SELECT * FROM trusted_device ORDER BY lastSeenAt DESC") fun observe(): Flow<List<TrustedDeviceEntity>>
    @Query("SELECT * FROM trusted_device WHERE id = :id") suspend fun get(id: String): TrustedDeviceEntity?
    @Upsert suspend fun upsert(device: TrustedDeviceEntity)
    @Query("UPDATE trusted_device SET grants = :grants WHERE id = :id") suspend fun setGrants(id: String, grants: Int)
    @Query("UPDATE trusted_device SET lastSeenAt = :at WHERE id = :id") suspend fun touch(id: String, at: Long)
    @Query("DELETE FROM trusted_device WHERE id = :id") suspend fun delete(id: String)
}

@Dao
interface PairedTvDao {
    @Query("SELECT * FROM paired_tv ORDER BY lastConnectedAt DESC") fun observe(): Flow<List<PairedTvEntity>>
    @Query("SELECT * FROM paired_tv WHERE id = :id") suspend fun get(id: String): PairedTvEntity?
    @Upsert suspend fun upsert(tv: PairedTvEntity)
    @Query("UPDATE paired_tv SET host = :host, port = :port, lastConnectedAt = :at WHERE id = :id") suspend fun seenAt(id: String, host: String, port: Int, at: Long)
    @Query("DELETE FROM paired_tv WHERE id = :id") suspend fun delete(id: String)
}

@Dao
interface ServiceDao {
    @Query("SELECT * FROM service ORDER BY name") fun observe(): Flow<List<ServiceEntity>>
    @Query("SELECT * FROM service") suspend fun all(): List<ServiceEntity>
    @Upsert suspend fun upsert(service: ServiceEntity)
    @Query("DELETE FROM service WHERE id = :id") suspend fun delete(id: String)
}

@Database(entities = [TrustedDeviceEntity::class, PairedTvEntity::class, ServiceEntity::class], version = 1, exportSchema = true)
abstract class HubDatabase : RoomDatabase() {
    abstract fun trustedDevices(): TrustedDeviceDao
    abstract fun pairedTvs(): PairedTvDao
    abstract fun services(): ServiceDao
}
