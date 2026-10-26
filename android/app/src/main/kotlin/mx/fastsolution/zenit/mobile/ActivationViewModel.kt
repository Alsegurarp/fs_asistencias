package mx.fastsolution.zenit.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import mx.fastsolution.zenit.mobile.data.DeviceActivationRepository
import org.json.JSONObject

data class ActivationUiState(
    val mode: String? = null,
    val breakPolicy: String? = null,
    val activated: Boolean = false,
    val busy: Boolean = false,
    val message: String = "Solicite a Recursos Humanos un código para vincular este dispositivo.",
)

class ActivationViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = DeviceActivationRepository(application)
    private val mutableState = MutableStateFlow(repository.current()?.let { summary(it) } ?: ActivationUiState())
    val state = mutableState.asStateFlow()

    fun activate(baseUrl: String, code: String) {
        if (mutableState.value.busy || mutableState.value.activated) return
        mutableState.value = ActivationUiState(busy = true, message = "Activando teléfono…")
        viewModelScope.launch {
            try {
                mutableState.value = summary(repository.activate(baseUrl, code))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.value = ActivationUiState(message = when (error) {
                    is IOException -> "No se pudo conectar. Revise la dirección y su conexión. Si el código se consumió, solicite otro a Recursos Humanos."
                    is IllegalArgumentException, is IllegalStateException -> error.message ?: "No se pudo activar."
                    else -> "No se pudo completar la activación. Solicite ayuda a soporte."
                })
            }
        }
    }

    private fun summary(activation: JSONObject) = ActivationUiState(
        mode = activation.getString("mode"),
        breakPolicy = activation.getJSONObject("session").getString("breakPolicy"),
        activated = true,
        message = "Teléfono activado para ${activation.getJSONObject("tenant").getString("name")}. " +
            if (activation.getString("mode") == "personal") "Modalidad personal." else "Modalidad terminal.",
    )
}
