package mx.fastsolution.zenit.device

import com.nimbusds.jose.JOSEException
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSObject
import com.nimbusds.jose.crypto.ECDSAVerifier
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jwt.SignedJWT
import mx.fastsolution.zenit.capture.CaptureProperties
import mx.fastsolution.zenit.tenant.TenantRepository
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.AuthenticatedPrincipal
import org.springframework.security.core.Authentication
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException
import org.springframework.security.oauth2.server.resource.authentication.BearerTokenAuthenticationToken
import org.springframework.stereotype.Component
import java.text.ParseException
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * Dispositivo que llama, ya verificado. Empresa, modalidad, persona y sede
 * salen de aquí: nunca del sobre ni del cuerpo.
 */
data class CurrentDevice(
    val id: UUID,
    val tenantId: UUID,
    val mode: String,
    /** Titular, en un teléfono personal. */
    val employeeId: UUID?,
    /** Sede, en una terminal. */
    val siteId: UUID?,
) : AuthenticatedPrincipal {
    override fun getName(): String = id.toString()
}

class DeviceAuthentication(private val device: CurrentDevice) :
    AbstractAuthenticationToken(listOf(SimpleGrantedAuthority("ROLE_$ROLE"))) {
    init {
        isAuthenticated = true
    }

    override fun getCredentials(): Any = ""

    override fun getPrincipal(): Any = device

    companion object {
        const val ROLE = "device"
    }
}

/** Claves de dispositivo: curva P-256, sólo la parte pública. */
object DeviceKeys {
    /** Lee una clave pública P-256. Rechaza otra curva y cualquier clave que traiga su parte privada. */
    fun parsePublic(jwk: Map<String, Any?>): ECKey? = try {
        val key = ECKey.parse(jwk)
        if (key.curve == Curve.P_256 && !key.isPrivate) key else null
    } catch (e: ParseException) {
        null
    }

    fun parseStored(json: String): ECKey = ECKey.parse(json)

    /**
     * Dice, sin verificar nada, si una cabecera de autorización trae una aserción
     * de dispositivo. Sólo sirve para elegir con qué se verifica.
     */
    fun isDeviceToken(authorization: String?): Boolean {
        val token = authorization?.takeIf { it.startsWith("Bearer ", ignoreCase = true) }?.substring(BEARER.length)?.trim() ?: return false
        return try {
            JWSObject.parse(token).header.algorithm == JWSAlgorithm.ES256
        } catch (e: ParseException) {
            false
        }
    }

    private const val BEARER = "Bearer "

    /** Verifica una firma ES256 hecha con esa clave. */
    fun verify(jws: JWSObject, key: ECKey): Boolean = try {
        jws.header.algorithm == JWSAlgorithm.ES256 && jws.verify(ECDSAVerifier(key))
    } catch (e: JOSEException) {
        false
    }

    /**
     * Aserción con la que un dispositivo se identifica: la firma él mismo,
     * dice quién es en `iss` y `sub`, va dirigida a este servicio y vive poco.
     */
    fun validAssertion(jwt: SignedJWT, key: ECKey, deviceId: UUID, audience: String, maxAge: Duration, skew: Duration, now: Instant): Boolean {
        if (!verify(jwt, key)) return false
        val claims = try {
            jwt.jwtClaimsSet
        } catch (e: ParseException) {
            return false
        }
        val issuedAt = claims.issueTime?.toInstant() ?: return false
        val expiresAt = claims.expirationTime?.toInstant() ?: return false
        return claims.issuer == deviceId.toString() &&
            claims.subject == deviceId.toString() &&
            audience in claims.audience &&
            expiresAt > issuedAt &&
            Duration.between(issuedAt, expiresAt) <= maxAge &&
            issuedAt <= now.plus(skew) &&
            expiresAt >= now.minus(skew)
    }
}

/**
 * Autentica a un dispositivo por su aserción. No hay token emitido por el
 * servidor que robar: lo que prueba la identidad es poseer la clave privada.
 */
@Component
class DeviceAuthenticator(
    private val devices: DeviceRepository,
    private val tenants: TenantRepository,
    private val capture: CaptureProperties,
) {
    fun authenticate(authentication: Authentication): Authentication {
        val token = (authentication as? BearerTokenAuthenticationToken)?.token ?: throw invalid()
        val jwt = try {
            SignedJWT.parse(token)
        } catch (e: ParseException) {
            throw invalid()
        }
        // El identificador se lee sin verificar sólo para encontrar la clave con la que se verifica.
        val deviceId = try {
            UUID.fromString(jwt.jwtClaimsSet.issuer ?: "")
        } catch (e: ParseException) {
            throw invalid()
        } catch (e: IllegalArgumentException) {
            throw invalid()
        }
        val device = devices.findForAuthentication(deviceId) ?: throw invalid()
        val valid = DeviceKeys.validAssertion(
            jwt, DeviceKeys.parseStored(device.publicJwk), deviceId, capture.audience,
            Duration.ofSeconds(capture.tokenMaxAgeSeconds), Duration.ofSeconds(capture.clockSkewSeconds), Instant.now(),
        )
        if (!valid || device.status != "active" || tenants.find(device.tenantId)?.status != "active") throw invalid()
        return DeviceAuthentication(CurrentDevice(device.id, device.tenantId, device.mode, device.employeeId, device.siteId))
    }

    /** El rechazo no dice el motivo: sólo que la credencial no sirve. */
    private fun invalid() = InvalidBearerTokenException("Credencial de dispositivo no válida")
}
