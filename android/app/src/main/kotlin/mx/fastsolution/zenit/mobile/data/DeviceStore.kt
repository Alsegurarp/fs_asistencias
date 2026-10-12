package mx.fastsolution.zenit.mobile.data

import android.content.Context
import android.content.SharedPreferences
import java.util.Base64
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import mx.fastsolution.zenit.mobile.security.OfflineEventCipher
import org.json.JSONObject

class DeviceStore(context: Context) {
    private val preferences = context.getSharedPreferences("capture_device", Context.MODE_PRIVATE)
    private val cipher = OfflineEventCipher()

    fun registration(): JSONObject? = read("registration")?.let(::JSONObject)
    fun saveRegistration(value: JSONObject) = write("registration", value.toString())
    fun notice(): String = read("notice") ?: "Acerca una tarjeta NFC"
    fun saveNotice(value: String) = write("notice", value)

    val changes = callbackFlow {
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> trySend(Unit) }
        preferences.registerOnSharedPreferenceChangeListener(listener)
        trySend(Unit)
        awaitClose { preferences.unregisterOnSharedPreferenceChangeListener(listener) }
    }

    private fun write(key: String, value: String) {
        val encrypted = cipher.encrypt(value.toByteArray(Charsets.UTF_8))
        val encoder = Base64.getEncoder()
        check(preferences.edit().putString(key, "${encoder.encodeToString(encrypted.initializationVector)}.${encoder.encodeToString(encrypted.ciphertext)}").commit()) {
            "No se pudo guardar el estado del dispositivo."
        }
    }

    private fun read(key: String): String? {
        val stored = preferences.getString(key, null) ?: return null
        val parts = stored.split('.')
        require(parts.size == 2) { "No se pudo leer el estado del dispositivo." }
        val decoder = Base64.getDecoder()
        return cipher.decrypt(decoder.decode(parts[1]), decoder.decode(parts[0])).toString(Charsets.UTF_8)
    }
}
