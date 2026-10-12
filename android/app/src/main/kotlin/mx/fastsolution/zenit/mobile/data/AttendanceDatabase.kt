package mx.fastsolution.zenit.mobile.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [PendingAttendanceEvent::class],
    version = 2,
    exportSchema = true,
)
abstract class AttendanceDatabase : RoomDatabase() {
    abstract fun pendingAttendanceDao(): PendingAttendanceDao

    companion object {
        @Volatile
        private var instance: AttendanceDatabase? = null

        fun get(context: Context): AttendanceDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AttendanceDatabase::class.java,
                    "attendance-offline.db",
                ).addMigrations(MIGRATION_1_2).build().also { instance = it }
            }

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE pending_attendance_event ADD COLUMN encryptedReceipt BLOB")
                db.execSQL("ALTER TABLE pending_attendance_event ADD COLUMN receiptInitializationVector BLOB")
            }
        }
    }
}

