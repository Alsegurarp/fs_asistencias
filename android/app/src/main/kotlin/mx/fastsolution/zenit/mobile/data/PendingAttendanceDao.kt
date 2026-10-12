package mx.fastsolution.zenit.mobile.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingAttendanceDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(event: PendingAttendanceEvent)

    @Query("SELECT COUNT(*) FROM pending_attendance_event WHERE status = 'pending_signed'")
    fun observePendingCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM pending_attendance_event WHERE status IN ('pending', 'previous_device')")
    fun observeLegacyCount(): Flow<Int>

    @Query("UPDATE pending_attendance_event SET status = 'previous_device' WHERE status = 'pending_signed'")
    suspend fun preservePreviousPending()

    @Query("SELECT COUNT(*) FROM pending_attendance_event WHERE status = 'pending_signed'")
    suspend fun pendingCount(): Int

    @Query("SELECT * FROM pending_attendance_event WHERE encryptedReceipt IS NOT NULL ORDER BY capturedAtEpochMillis DESC, id DESC LIMIT 10")
    fun observeReceipts(): Flow<List<PendingAttendanceEvent>>

    @Query("UPDATE pending_attendance_event SET status = :status, encryptedReceipt = :receipt, receiptInitializationVector = :iv WHERE id = :id AND status = 'pending_signed'")
    // shortcut: conserva sobres y recibos sin purga; definir retención antes de terminales en uso continuo.
    suspend fun complete(id: String, status: String, receipt: ByteArray, iv: ByteArray)

    @Query(
        """
        SELECT * FROM pending_attendance_event
        WHERE status = 'pending_signed'
        ORDER BY capturedAtEpochMillis ASC, rowid ASC
        LIMIT :limit
        """,
    )
    suspend fun nextPending(limit: Int): List<PendingAttendanceEvent>
}

