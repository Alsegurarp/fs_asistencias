package mx.fastsolution.zenit.mobile.data

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import java.net.HttpURLConnection
import java.net.URI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import mx.fastsolution.zenit.mobile.BuildConfig
import mx.fastsolution.zenit.mobile.security.DeviceIdentity
import org.json.JSONObject

class DeviceActivationRepository(private val context: Context) {
    private val preferences = context.getSharedPreferences("device_activation", Context.MODE_PRIVATE)
    private val identity = DeviceIdentity()

    fun current(): JSONObject? = preferences.getString("activation", null)?.let { JSONObject(it) }

    suspend fun activate(baseUrl: String, code: String): JSONObject = withContext(Dispatchers.IO) {
        check(current() == null) { "Este teléfono ya está activado." }
        val uri = URI(baseUrl.trim().trimEnd('/'))
        require(uri.host != null && uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null) {
            "Escribe una dirección válida del servidor."
        }
        require(uri.scheme == "https" ||
            (BuildConfig.DEBUG && uri.scheme == "http" && uri.host in setOf("localhost", "127.0.0.1", "10.0.2.2"))) {
            "El servidor debe usar HTTPS; HTTP local sólo se permite en depuración."
        }
        val normalizedCode = code.trim().uppercase(java.util.Locale.ROOT)
        require(normalizedCode.length in 6..32) { "Revise el código de activación proporcionado por Recursos Humanos." }
        check(context.getSystemService(KeyguardManager::class.java).isDeviceSecure) {
            "Configura un bloqueo de pantalla antes de activar el teléfono."
        }
        val payload = JSONObject()
            .put("enrollmentCode", normalizedCode)
            .put("publicKey", identity.publicJwk())
            .put("proof", identity.activationProof(normalizedCode))
            .put("screenLock", true)
            .put("device", JSONObject().put("manufacturer", Build.MANUFACTURER.take(60))
                .put("model", Build.MODEL.take(60)).put("androidSdk", Build.VERSION.SDK_INT)
                .put("appVersion", BuildConfig.VERSION_NAME))
        val connection = URI("$uri/api/v1/device-activations").toURL().openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            when (connection.responseCode) {
                201 -> {
                    val activation = connection.inputStream.bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
                    activation.getString("deviceId")
                    activation.getString("mode")
                    activation.getString("audience")
                    activation.getJSONObject("session").getString("sessionId")
                    check(preferences.edit().putString("activation", activation.toString())
                        .putString("baseUrl", uri.toString()).commit()) { "No se pudo guardar la activación." }
                    activation
                }
                410 -> error("El código venció o ya no está disponible. Solicite otro a Recursos Humanos.")
                429 -> error("Demasiados intentos. Espere un minuto antes de volver a intentar.")
                422 -> error("No se pudo validar el dispositivo. Revise el código y solicite ayuda a soporte.")
                else -> error("El servidor no pudo activar el teléfono. Intenta más tarde.")
            }
        } finally {
            connection.disconnect()
        }
    }
}
