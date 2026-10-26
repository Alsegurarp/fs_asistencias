package mx.fastsolution.zenit.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.time.Instant
import android.os.SystemClock
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import mx.fastsolution.zenit.mobile.data.AttendanceRepository
import mx.fastsolution.zenit.mobile.data.AttendanceSyncWorker
import mx.fastsolution.zenit.mobile.data.CaptureApiException

data class CaptureUiState(
    val pendingCount: Int = 0,
    val message: String = "Aproxime una tarjeta NFC al lector",
    val isCapturing: Boolean = false,
    val registered: Boolean = false,
    val deviceLabel: String = "",
    val serverUrl: String = "https://zenit.fastsolution.com.mx",
    val breakPolicy: String = "not_considered",
    val sessionUsable: Boolean = false,
    val legacyCount: Int = 0,
    val receipts: List<String> = emptyList(),
    val personal: Boolean = false,
)

class AttendanceViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = AttendanceRepository(application)
    private val captureState = MutableStateFlow(CaptureUiState(message = ""))
    private var declaredType: String? = null
    private val registration = repository.store.changes.map { repository.store.registration() }.flowOn(Dispatchers.IO)

    val state = combine(captureState, repository.pendingCount, repository.legacyCount, registration, repository.receipts) { current, pendingCount, legacyCount, device, receipts ->
        current.copy(
            pendingCount = pendingCount,
            legacyCount = legacyCount,
            registered = device != null,
            personal = device?.optString("mode") == "personal",
            serverUrl = device?.getString("baseUrl") ?: current.serverUrl,
            deviceLabel = device?.let {
                val label = it.optJSONObject("employee")?.optString("displayName") ?: it.optJSONObject("site")?.optString("name").orEmpty()
                "${it.getJSONObject("tenant").getString("name")} · $label"
            }.orEmpty(),
            breakPolicy = device?.getJSONObject("session")?.getString("breakPolicy") ?: "not_considered",
            sessionUsable = device?.let { AttendanceRepository.sessionUsable(it) } ?: false,
            message = current.message.ifBlank { repository.store.notice() },
            receipts = receipts.filter { repository.belongsToDevice(it, device?.getString("deviceId")) }.map(repository::readReceipt),
        )
    }.flowOn(Dispatchers.IO).catch {
        emit(CaptureUiState(message = "No se pudo leer la cola o las claves locales. Los datos se conservan; solicite revisión a Recursos Humanos."))
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = CaptureUiState(),
    )

    init { AttendanceSyncWorker.schedule(application) }

    val weekState = MutableStateFlow(PersonalWeekState())

    fun loadWeek(date: String) = viewModelScope.launch {
        if (weekState.value.busy || captureState.value.isCapturing) return@launch
        weekState.value = PersonalWeekState(busy = true)
        try {
            val week = repository.personalWeek(date)
            val receipt = week.optJSONObject("_localAcknowledgement")
            personalWeekReport(week, receipt) // Validar la respuesta antes de mostrarla en Compose.
            weekState.value = PersonalWeekState(week = week, acknowledgement = receipt)
        } catch (error: CancellationException) { throw error
        } catch (error: Exception) {
            weekState.value = PersonalWeekState(message = if (error is CaptureApiException) error.message.orEmpty() else "No se pudo consultar la semana. Revise la conexión y vuelva a intentarlo.")
        }
    }

    fun acknowledgeWeek(id: String, type: String, note: String) = viewModelScope.launch {
        val current = weekState.value
        if (current.busy || captureState.value.isCapturing || !current.allowAcknowledgement || current.acknowledgement != null || current.week?.optJSONObject("closure")?.optString("id") != id) return@launch
        weekState.value = current.copy(busy = true, message = "")
        try {
            val receipt = repository.acknowledgeWeek(id, type, note)
            weekState.value = current.copy(acknowledgement = receipt, message = "Respuesta confirmada por el servidor.")
        } catch (error: CancellationException) { throw error
        } catch (error: Exception) {
            // Una respuesta perdida puede haberse guardado: no se reintenta automáticamente.
            weekState.value = current.copy(allowAcknowledgement = false, message = if (error is CaptureApiException && error.status == 409)
                "Este cierre ya tiene acuse o cambió de estado. Solicite a Recursos Humanos confirmar el registro antes de responder otra vez."
                else "No se pudo confirmar la respuesta. Puede haberse guardado; consulte a Recursos Humanos antes de reenviarla.")
        }
    }

    fun activate(baseUrl: String, code: String, preservePreviousPending: Boolean) = perform {
        check(!weekState.value.busy) { "Espere a que termine la consulta o el acuse antes de cambiar de vinculación." }
        repository.activate(baseUrl, code, preservePreviousPending)
        weekState.value = PersonalWeekState()
        AttendanceSyncWorker.schedule(getApplication())
    }

    fun renewSession() = perform { repository.renewSession() }

    fun selectType(type: String?) { declaredType = type }

    fun synchronize() = perform {
        withContext(Dispatchers.IO) { repository.store.saveNotice("Sincronización solicitada. Los marcajes permanecen guardados hasta recibir confirmación.") }
        AttendanceSyncWorker.schedule(getApplication())
    }

    fun captureTag(tagId: ByteArray) {
        val observedAt = Instant.now()
        val elapsed = SystemClock.elapsedRealtime()
        val selected = declaredType
        perform {
            repository.capture(tagId, selected, observedAt, elapsed)
            AttendanceSyncWorker.schedule(getApplication())
        }
    }

    private fun perform(action: suspend () -> Unit) = viewModelScope.launch {
        if (captureState.value.isCapturing) return@launch
        captureState.value = captureState.value.copy(message = "Procesando…", isCapturing = true)
        try {
            action()
            captureState.value = captureState.value.copy(message = "")
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            val message = when (error) {
                is CaptureApiException -> error.message
                is IOException -> "No se pudo conectar con el servidor. Los datos locales se conservan."
                is IllegalArgumentException, is IllegalStateException -> error.message
                else -> "No se pudo completar la operación. Los datos locales se conservan."
            }
            captureState.value = captureState.value.copy(message = message ?: "No se pudo completar la operación.")
        } finally {
            captureState.value = captureState.value.copy(isCapturing = false)
        }
    }
}
