package mx.fastsolution.zenit.mobile.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AttendanceSyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val repository = AttendanceRepository(applicationContext)
        try {
            repository.synchronize()
            Result.success()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            repository.store.saveNotice(when (error) {
                is CaptureApiException -> error.message ?: "No se pudo sincronizar."
                is IOException -> "Sin conexión con el servidor. Se conservan los marcajes y se reintentará."
                else -> "No se pudo sincronizar. Los marcajes se conservan; solicite revisión a Recursos Humanos."
            })
            if ((error is CaptureApiException && (error.status == 429 || error.status >= 500)) ||
                (error is IOException && error !is CaptureApiException)) Result.retry() else Result.failure()
        }
    }

    companion object {
        fun schedule(context: Context) {
            val request = OneTimeWorkRequestBuilder<AttendanceSyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
            WorkManager.getInstance(context).enqueueUniqueWork("attendance_sync", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }
    }
}
