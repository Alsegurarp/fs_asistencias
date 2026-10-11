package mx.fastsolutions.jornada.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.time.Instant
import java.util.UUID
import org.json.JSONObject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import mx.fastsolutions.jornada.mobile.capture.TagEvidenceHasher
import mx.fastsolutions.jornada.mobile.data.AttendanceDatabase
import mx.fastsolutions.jornada.mobile.data.AttendanceRepository
import mx.fastsolutions.jornada.mobile.data.PendingAttendanceEvent
import mx.fastsolutions.jornada.mobile.location.CurrentLocationProvider
import mx.fastsolutions.jornada.mobile.security.OfflineEventCipher

data class CaptureUiState(
    val pendingCount: Int = 0,
    val message: String = "Acerca una tarjeta NFC",
    val isCapturing: Boolean = false,
)

class AttendanceViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = AttendanceRepository(
        AttendanceDatabase.get(application).pendingAttendanceDao(),
    )
    private val locationProvider = CurrentLocationProvider(application)
    private val offlineEventCipher = OfflineEventCipher()
    private val captureState = MutableStateFlow(CaptureUiState())

    val state = combine(captureState, repository.pendingCount) { current, pendingCount ->
        current.copy(pendingCount = pendingCount)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = CaptureUiState(),
    )

    fun captureTag(tagId: ByteArray) {
        if (captureState.value.isCapturing) return

        viewModelScope.launch {
            captureState.value = captureState.value.copy(
                message = "Capturando ubicacion puntual...",
                isCapturing = true,
            )

            runCatching {
                val location = locationProvider.capture()
                val capturedAt = Instant.now().toEpochMilli()
                val payload = JSONObject()
                    .put("tagEvidence", TagEvidenceHasher.sha256(tagId))
                    .put("capturedAtEpochMillis", capturedAt)
                    .put("latitude", location?.latitude ?: JSONObject.NULL)
                    .put("longitude", location?.longitude ?: JSONObject.NULL)
                    .put("accuracyMeters", location?.accuracyMeters ?: JSONObject.NULL)
                    .toString()
                    .encodeToByteArray()
                val encrypted = offlineEventCipher.encrypt(payload)
                repository.enqueue(
                    PendingAttendanceEvent(
                        id = UUID.randomUUID().toString(),
                        encryptedPayload = encrypted.ciphertext,
                        initializationVector = encrypted.initializationVector,
                        capturedAtEpochMillis = capturedAt,
                    ),
                )
                location
            }.onSuccess { location ->
                captureState.value = CaptureUiState(
                    message = if (location == null) {
                        "Marcaje guardado sin ubicacion; requiere revision"
                    } else {
                        "Marcaje guardado para sincronizacion"
                    },
                )
            }.onFailure {
                captureState.value = CaptureUiState(
                    message = "No se pudo guardar el marcaje",
                )
            }
        }
    }
}
