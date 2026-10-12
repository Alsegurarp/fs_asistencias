package mx.fastsolution.zenit.mobile.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "pending_attendance_event",
    indices = [Index(value = ["status", "capturedAtEpochMillis"])],
)
data class PendingAttendanceEvent(
    @PrimaryKey val id: String,
    val encryptedPayload: ByteArray,
    val initializationVector: ByteArray,
    val capturedAtEpochMillis: Long,
    val status: String = STATUS_PENDING,
    val encryptedReceipt: ByteArray? = null,
    val receiptInitializationVector: ByteArray? = null,
) {
    companion object {
        const val STATUS_PENDING = "pending_signed"
    }
}
