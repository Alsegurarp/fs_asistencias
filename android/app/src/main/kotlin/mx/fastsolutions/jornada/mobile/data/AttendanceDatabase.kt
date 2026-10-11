package mx.fastsolutions.jornada.mobile.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [PendingAttendanceEvent::class],
    version = 1,
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
                ).build().also { instance = it }
            }
    }
}

