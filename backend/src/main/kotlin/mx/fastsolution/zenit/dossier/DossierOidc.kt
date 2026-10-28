package mx.fastsolution.zenit.dossier

import mx.fastsolution.zenit.api.ApiException
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.export.sha256
import mx.fastsolution.zenit.security.IdentityProperties
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets.UTF_8
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.Base64

@ConfigurationProperties("zenit.dossier")
data class DossierProperties(val clientId: String = "zenit-dossier", val redirectUri: String = "http://localhost:8081/dossier/callback", val tokenUri: String = "")

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(DossierProperties::class)
class DossierConfig

internal fun verificationFailed() = ApiException(HttpStatus.FORBIDDEN, "forbidden", "verification_failed", "Verificación no válida")
internal fun identityUnavailable() = ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "identity_unavailable", "Identidad no disponible", "Inicia otra verificación cuando el proveedor esté disponible.")
internal fun hashMatches(value: String, expected: String): Boolean = MessageDigest.isEqual(sha256(value.toByteArray(UTF_8)).toByteArray(UTF_8), expected.trim().toByteArray(UTF_8))
internal fun pkce(value: String): String = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(value.toByteArray(UTF_8)))
internal fun strictText(field: String, value: JsonNode?, pattern: Regex? = null, max: Int = 2048): String {
    val text = value?.takeIf { it.isString }?.asString()
    if (text.isNullOrEmpty() || text.length > max || text.any { it < ' ' } || (pattern != null && !text.matches(pattern))) {
        throw Problems.validation(field, "invalid_value", "El campo $field no tiene el formato admitido.")
    }
    return text
}

@Component
@Profile("!migrate")
class DossierOidc(private val identity: IdentityProperties, private val settings: DossierProperties, private val json: JsonMapper) {
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build()
    private val decoder by lazy {
        NimbusJwtDecoder.withJwkSetUri(identity.jwksUri).build().apply {
            setJwtValidator(DelegatingOAuth2TokenValidator(JwtValidators.createDefaultWithIssuer(identity.issuer), OAuth2TokenValidator<Jwt> { jwt ->
                if (jwt.audience?.contains(settings.clientId) == true && !jwt.subject.isNullOrBlank()) OAuth2TokenValidatorResult.success()
                else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token"))
            }))
        }
    }

    fun authorizationUrl(state: String, nonce: String, challenge: String): String {
        endpoint(settings.redirectUri)
        endpoint(identity.issuer)
        val parameters = linkedMapOf("client_id" to settings.clientId, "redirect_uri" to settings.redirectUri, "response_type" to "code", "scope" to "openid",
            "state" to state, "nonce" to nonce, "code_challenge_method" to "S256", "code_challenge" to challenge, "acr_values" to "2",
            "claims" to "{\"id_token\":{\"acr\":{\"essential\":true,\"values\":[\"2\"]}}}")
        return identity.issuer.trimEnd('/') + "/protocol/openid-connect/auth?" + form(parameters)
    }

    fun verify(code: String, verifier: String, subject: String, nonceHash: String, createdAt: Instant) {
        val tokenUri = settings.tokenUri.ifBlank { identity.issuer.trimEnd('/') + "/protocol/openid-connect/token" }
        val response = try {
            http.send(HttpRequest.newBuilder(endpoint(tokenUri)).timeout(Duration.ofSeconds(10)).header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form(mapOf("grant_type" to "authorization_code", "client_id" to settings.clientId,
                    "redirect_uri" to settings.redirectUri, "code" to code, "code_verifier" to verifier)))).build(), HttpResponse.BodyHandlers.ofString())
        } catch (_: InterruptedException) { Thread.currentThread().interrupt(); throw identityUnavailable() }
        catch (_: Exception) { throw identityUnavailable() }
        if (response.statusCode() >= 500 || response.statusCode() in 300..399) throw identityUnavailable()
        if (response.statusCode() != 200) throw verificationFailed()
        try {
            val token = json.readTree(response.body()).get("id_token")?.takeIf { it.isString }?.asString() ?: throw verificationFailed()
            val jwt = decoder.decode(token)
            check(jwt.subject == subject && jwt.getClaimAsString("acr") == "2")
            check(jwt.expiresAt?.isAfter(Instant.now()) == true)
            check(jwt.issuedAt?.isBefore(createdAt.minusSeconds(1)) == false)
            check(jwt.issuedAt?.isAfter(Instant.now().plusSeconds(30)) == false)
            check(jwt.getClaimAsString("azp")?.let { it == settings.clientId } ?: (jwt.audience?.size == 1))
            check(hashMatches(jwt.getClaimAsString("nonce") ?: "", nonceHash))
        } catch (_: Exception) { throw verificationFailed() }
    }

    private fun endpoint(value: String): URI {
        val uri = try { URI.create(value) } catch (_: Exception) { throw identityUnavailable() }
        if (uri.host == null || uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null ||
            !(uri.scheme == "https" || (uri.scheme == "http" && uri.host in setOf("localhost", "127.0.0.1", "keycloak")))) throw identityUnavailable()
        return uri
    }
    private fun form(values: Map<String, String>) = values.entries.joinToString("&") { URLEncoder.encode(it.key, UTF_8) + "=" + URLEncoder.encode(it.value, UTF_8) }
}
