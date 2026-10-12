package mx.fastsolution.zenit.mobile.data

import java.io.IOException
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.time.Duration
import java.time.Instant
import mx.fastsolution.zenit.mobile.BuildConfig
import org.json.JSONObject

class CaptureApiException(val status: Int, val code: String, message: String) : IOException(message)

class CaptureApi(private val baseUrl: String) {
    fun post(path: String, body: JSONObject, assertion: String? = null): JSONObject {
        val connection = URI("$baseUrl/api/v1$path").toURL().openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 10_000
            connection.readTimeout = 30_000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Content-Type", "application/json")
            if (assertion != null) connection.setRequestProperty("Authorization", "Bearer $assertion")
            connection.doOutput = true
            val request = body.toString().toByteArray(Charsets.UTF_8)
            connection.setFixedLengthStreamingMode(request.size)
            connection.outputStream.use { it.write(request) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (output.size() + count > 1_048_576) throw IOException("La respuesta del servidor excedió el límite permitido.")
                    output.write(buffer, 0, count)
                }
                output.toString("UTF-8")
            }.orEmpty()
            val json = if (text.isBlank()) JSONObject() else try { JSONObject(text) } catch (_: Exception) {
                throw IOException("El servidor respondió con un formato no válido (HTTP $status).")
            }
            if (status !in 200..299) {
                val fields = json.optJSONArray("errors")
                val detail = if (fields != null && fields.length() > 0) (0 until fields.length()).joinToString("\n") {
                    fields.getJSONObject(it).optString("message")
                } else json.optString("detail", json.optString("title", "HTTP $status"))
                val hint = when (status) {
                    401 -> {
                        val serverTime = runCatching { Instant.parse(json.getString("serverTime")) }.getOrNull()
                        if (serverTime != null && kotlin.math.abs(Duration.between(Instant.now(), serverTime).seconds) > 60)
                            "Corrige la fecha y hora del teléfono antes de reintentar."
                        else "El dispositivo no tiene acceso. Consulta a RH: puede estar revocado, reemplazado o su empresa suspendida."
                    }
                    410 -> "El código venció o ya se usó. Solicita otro código a RH."
                    429 -> "Demasiados intentos. Se reintentará con una pausa."
                    else -> detail
                }
                val correlation = json.optString("correlationId")
                throw CaptureApiException(status, json.optString("code"), "$hint${if (correlation.isBlank()) "" else "\nReferencia: $correlation"}")
            }
            return json
        } finally { connection.disconnect() }
    }

    companion object {
        fun validateBaseUrl(value: String): String {
            val uri = runCatching { URI(value.trim().trimEnd('/')) }.getOrNull()
            require(uri != null && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.query == null && uri.fragment == null && uri.path.orEmpty().isEmpty()) {
                "Introduce la dirección del servidor, sin rutas ni credenciales."
            }
            require(uri.scheme == "https" || (BuildConfig.DEBUG && uri.scheme == "http" && uri.host in setOf("localhost", "127.0.0.1", "::1"))) {
                "El servidor debe usar HTTPS. En pruebas USB se permite http://localhost:8080."
            }
            return uri.toString()
        }
    }
}
