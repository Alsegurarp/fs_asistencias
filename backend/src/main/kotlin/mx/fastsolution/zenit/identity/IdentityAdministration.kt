package mx.fastsolution.zenit.identity

import mx.fastsolution.zenit.api.ApiException
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets.UTF_8
import java.time.Duration

@ConfigurationProperties("zenit.identity-admin")
data class IdentityAdminProperties(val url: String = "", val clientId: String = "zenit-password-admin", val clientSecret: String = "")

/** Sólo añade UPDATE_PASSWORD; nunca recibe contraseñas ni modifica credenciales OTP. */
@Service
class IdentityAdministration(private val settings: IdentityAdminProperties, private val json: JsonMapper) {
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build()

    fun requirePasswordChange(subject: String, email: String) {
        try {
            check(settings.url.isNotBlank() && settings.clientSecret.isNotBlank())
            val origin = URI.create(settings.url)
            check(origin.host != null && origin.rawUserInfo == null && origin.rawQuery == null && origin.rawFragment == null && origin.path in listOf("", "/"))
            check(origin.scheme == "https" || (origin.scheme == "http" && origin.host in setOf("localhost", "127.0.0.1", "keycloak")))
            val base = settings.url.trimEnd('/')
            fun encode(value: String) = URLEncoder.encode(value, UTF_8)
            val form = "grant_type=client_credentials&client_id=${encode(settings.clientId)}&client_secret=${encode(settings.clientSecret)}"
            val token = send(HttpRequest.newBuilder(URI.create("$base/realms/zenit/protocol/openid-connect/token"))
                .header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form)), 200)["access_token"] as? String
            check(!token.isNullOrBlank())
            val url = URI.create("$base/admin/realms/zenit/users/${encode(subject)}")
            val user = send(HttpRequest.newBuilder(url).header("Authorization", "Bearer $token").GET(), 200)
            check(user["id"] == subject && (user["email"] as? String)?.equals(email, ignoreCase = true) == true)
            check(user["enabled"] == true && user["emailVerified"] == true)
            val actions = (user["requiredActions"] ?: emptyList<String>()) as? List<*> ?: error("invalid_actions")
            check(actions.all { it is String })
            // shortcut: Keycloak no ofrece CAS para requiredActions; coordinar cambios externos concurrentes antes de ampliar su administración.
            if ("UPDATE_PASSWORD" !in actions) {
                send(HttpRequest.newBuilder(url).header("Authorization", "Bearer $token").header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(mapOf("requiredActions" to actions + "UPDATE_PASSWORD")))), 204)
            }
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            throw unavailable()
        } catch (_: Exception) {
            // No copiar errores del proveedor: pueden contener credenciales o datos personales.
            throw unavailable()
        }
    }

    private fun send(request: HttpRequest.Builder, expected: Int): Map<*, *> {
        val response = http.send(request.timeout(Duration.ofSeconds(10)).build(), HttpResponse.BodyHandlers.ofString())
        check(response.statusCode() == expected)
        return if (expected == 204) emptyMap<String, Any>() else json.readValue(response.body(), Map::class.java)
    }

    private fun unavailable() = ApiException(HttpStatus.SERVICE_UNAVAILABLE, "identity-unavailable", "identity_unavailable",
        "Identidad no disponible", "No se pudo confirmar el cambio obligatorio. Solicita a operación revisar la integración y vuelve a intentarlo.")
}
