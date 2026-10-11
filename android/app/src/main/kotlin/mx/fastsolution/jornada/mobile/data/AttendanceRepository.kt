package mx.fastsolution.jornada.mobile.data

import kotlinx.coroutines.flow.Flow

class AttendanceRepository(
    private val dao: PendingAttendanceDao,
) {
    val pendingCount: Flow<Int> = dao.observePendingCount()

    suspend fun enqueue(event: PendingAttendanceEvent) {
        dao.insert(event)
    }
}

