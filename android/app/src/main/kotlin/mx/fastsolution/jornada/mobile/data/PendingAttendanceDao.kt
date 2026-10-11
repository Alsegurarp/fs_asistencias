package mx.fastsolution.jornada.mobile.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingAttendanceDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(event: PendingAttendanceEvent)

    @Query("SELECT COUNT(*) FROM pending_attendance_event WHERE status = 'pending'")
    fun observePendingCount(): Flow<Int>

    @Query(
        """
        SELECT * FROM pending_attendance_event
        WHERE status = 'pending'
        ORDER BY capturedAtEpochMillis ASC
        LIMIT :limit
        """,
    )
    suspend fun nextPending(limit: Int): List<PendingAttendanceEvent>
}

