package mx.fastsolution.zenit.identity

import mx.fastsolution.zenit.api.ApiException
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets.UTF_8
import java.time.Duration
import java.util.UUID
import java.util.HexFormat
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@Service
class AuditIdentityProvisioning(
    private val json: JsonMapper,
    @Value("\${ZENIT_AUDIT_KEYCLOAK_URL:}") private val identityUrl: String,
    @Value("\${audit_keycloak_client_secret:}") private val secret: String,
) {
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4))
        .followRedirects(HttpClient.Redirect.NEVER).build()

    fun prepare(email: String, name: String) {
        try {
            val origin = URI.create(identityUrl)
            check(origin.host != null && origin.rawUserInfo == null && origin.rawQuery == null &&
                origin.rawFragment == null && origin.path in listOf("", "/") && secret.isNotBlank())
            check(origin.scheme == "https" ||
                (origin.scheme == "http" && origin.host in setOf("keycloak", "localhost", "127.0.0.1")))
            val base = identityUrl.trimEnd('/')
            val authorization = send(
                HttpRequest.newBuilder(URI.create("$base/realms/zenit/protocol/openid-connect/token"))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(body("grant_type=client_credentials&client_id=zenit-audit-provisioning&client_secret=${encode(secret)}")),
                200,
            )
            val token = json.readTree(authorization.body()).path("access_token").asText()
            check(token.isNotBlank())
            val users = "$base/admin/realms/zenit/users"
            val username = auditUsername(email)
            fun request(path: String) = HttpRequest.newBuilder(URI.create(path)).header("Authorization", "Bearer $token")
            fun find(): JsonNode? {
                val result = json.readTree(send(request("$users?email=${encode(email)}&exact=true&max=2").GET(), 200).body())
                check(result.isArray && result.size() <= 1)
                return result.firstOrNull()?.also {
                    check(it.path("email").asText().equals(email, ignoreCase = true))
                }
            }
            val existing = find()
            if (existing != null) {
                check(existing.path("enabled").asBoolean())
                if (!isPendingAuditAccount(existing, username)) return
            }
            val id = if (existing == null) {
                val payload = mapOf(
                    "username" to username, "email" to email, "enabled" to true, "emailVerified" to false,
                    "firstName" to name.trim().substringBefore(' ').ifBlank { "Auditoría" },
                    "lastName" to name.trim().substringAfter(' ', "").trim().ifBlank { "Externa" },
                    "requiredActions" to ACTIONS,
                )
                val created = send(request(users).header("Content-Type", "application/json")
                    .POST(body(json.writeValueAsString(payload))), 201, 409)
                if (created.statusCode() == 409) {
                    val concurrent = checkNotNull(find())
                    check(concurrent.path("enabled").asBoolean())
                    if (!isPendingAuditAccount(concurrent, username)) return
                    concurrent.path("id").asText()
                } else {
                    created.headers().firstValue("Location").orElseThrow().substringAfterLast('/')
                }
            } else {
                existing.path("id").asText()
            }
            val accountId = UUID.fromString(id)
            send(
                request("$users/$accountId/execute-actions-email?lifespan=259200")
                    .header("Content-Type", "application/json")
                    .PUT(body(json.writeValueAsString(ACTIONS))),
                204,
            )
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            throw unavailable()
        } catch (_: Exception) {
            throw unavailable()
        }
    }

    private fun isPendingAuditAccount(user: JsonNode, username: String): Boolean =
        !user.path("emailVerified").asBoolean() &&
            user.path("username").asText() == username &&
            user.path("requiredActions").any { it.asText() == "UPDATE_PASSWORD" }

    private fun auditUsername(email: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(UTF_8), "HmacSHA256"))
        return "zenit-audit-" + HexFormat.of().formatHex(mac.doFinal(email.toByteArray(UTF_8))).take(32)
    }

    private fun send(request: HttpRequest.Builder, vararg expected: Int): HttpResponse<String> {
        val response = http.send(request.timeout(Duration.ofSeconds(7)).build(), HttpResponse.BodyHandlers.ofString())
        check(response.statusCode() in expected)
        return response
    }

    private fun body(value: String) = HttpRequest.BodyPublishers.ofString(value, UTF_8)
    private fun encode(value: String) = URLEncoder.encode(value, UTF_8)

    private fun unavailable() = ApiException(HttpStatus.SERVICE_UNAVAILABLE, "audit-identity-unavailable",
        "audit_identity_unavailable", "Invitación no disponible")

    companion object {
        private val ACTIONS = listOf("VERIFY_EMAIL", "UPDATE_PASSWORD", "CONFIGURE_TOTP")
    }
}
