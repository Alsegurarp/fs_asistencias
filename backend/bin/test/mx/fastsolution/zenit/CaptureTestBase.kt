package mx.fastsolution.zenit

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.JWSObject
import com.nimbusds.jose.Payload
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import java.time.Instant
import java.util.Date
import java.util.UUID
import kotlin.test.assertEquals

/**
 * Simula lo que hace la app: genera su clave, se activa con un código, firma
 * su aserción y firma cada marcaje. La clave privada nunca viaja.
 */
abstract class CaptureTestBase : ApiTestBase() {
    protected class Phone(val key: ECKey) {
        var id = ""
        var session = ""
        var sequence = 0
    }

    protected fun newKey(): ECKey = ECKeyGenerator(Curve.P_256).generate()

    protected fun fingerprint() = UUID.randomUUID().toString().replace("-", "")

    protected fun newSite(c: Company): String {
        val reply = call(
            "POST", "/api/v1/sites", c.adminToken,
            """{"name":"Sede ${UUID.randomUUID().toString().take(6)}","timeZone":"America/Mexico_City","latitude":19.432608,"longitude":-99.133209,"radiusMeters":80}""",
        )
        assertEquals(201, reply.status, reply.toString())
        return reply.at("id")
    }

    protected fun newEmployee(c: Company, siteId: String? = null): String {
        val site = siteId?.let { "\"$it\"" } ?: "null"
        val external = "E-${UUID.randomUUID().toString().take(8)}"
        val reply = call(
            "POST", "/api/v1/employees", c.adminToken,
            """{"externalId":"$external","displayName":"Persona $external","siteId":$site,"employmentStart":"2026-01-05"}""",
        )
        assertEquals(201, reply.status, reply.toString())
        return reply.at("id")
    }

    /** Tarjeta registrada y, si se da una persona, asignada a ella. Devuelve su huella. */
    protected fun newCard(c: Company, employeeId: String? = null): String {
        val print = fingerprint()
        val card = call("POST", "/api/v1/cards", c.adminToken, """{"label":"ZN-${print.take(8)}","fingerprint":"$print"}""")
        assertEquals(201, card.status, card.toString())
        if (employeeId != null) {
            val assigned = call("POST", "/api/v1/cards/${card.at<String>("id")}/assignments", c.adminToken, """{"employeeId":"$employeeId"}""")
            assertEquals(201, assigned.status, assigned.toString())
        }
        return print
    }

    protected fun enroll(c: Company, body: String): Reply = call("POST", "/api/v1/device-enrollments", c.adminToken, body)

    protected fun proof(key: ECKey, code: String): String =
        JWSObject(JWSHeader(JWSAlgorithm.ES256), Payload(json(mapOf("enrollmentCode" to code)))).apply { sign(ECDSASigner(key)) }.serialize()

    protected fun activation(
        code: String,
        key: ECKey,
        proof: String = proof(key, code),
        screenLock: Boolean = true,
        sdk: Int = 34,
        jwk: String = key.toPublicJWK().toJSONString(),
        forwardedFor: String? = null,
    ): Reply = call(
        "POST", "/api/v1/device-activations", null,
        """{"enrollmentCode":"$code","publicKey":$jwk,"proof":"$proof","device":{"manufacturer":"Ficticia",""" +
            """"model":"Modelo 1","androidSdk":$sdk,"appVersion":"0.1.0"},"screenLock":$screenLock}""",
        forwardedFor?.let { mapOf("X-Forwarded-For" to it) } ?: emptyMap(),
    )

    /** Dispositivo ya activado, con su primera sesión abierta. */
    protected fun activated(c: Company, enrollmentBody: String): Phone {
        val enrollment = enroll(c, enrollmentBody)
        assertEquals(201, enrollment.status, enrollment.toString())
        val phone = Phone(newKey())
        val reply = activation(enrollment.at("code"), phone.key)
        assertEquals(201, reply.status, reply.toString())
        phone.id = reply.at("deviceId")
        phone.session = reply.at("session.sessionId")
        return phone
    }

    protected fun phone(c: Company, employeeId: String): Phone = activated(c, """{"mode":"personal","employeeId":"$employeeId"}""")

    protected fun terminal(c: Company, siteId: String): Phone = activated(c, """{"mode":"terminal","siteId":"$siteId","label":"Recepción"}""")

    /** Aserción con la que el dispositivo se identifica en cada petición. */
    protected fun assertion(
        p: Phone,
        audience: String = "zenit-capture",
        issuedAgo: Long = 0,
        lifetime: Long = 60,
        signer: ECKey = p.key,
        issuer: String = p.id,
    ): String {
        val issuedAt = Instant.now().minusSeconds(issuedAgo)
        val claims = JWTClaimsSet.Builder().issuer(issuer).subject(issuer).audience(audience)
            .issueTime(Date.from(issuedAt)).expirationTime(Date.from(issuedAt.plusSeconds(lifetime))).build()
        return SignedJWT(JWSHeader.Builder(JWSAlgorithm.ES256).keyID(p.id).build(), claims).apply { sign(ECDSASigner(signer)) }.serialize()
    }

    protected fun here(accuracy: Double = 12.0, latitude: Double = 19.432608, longitude: Double = -99.133209, mock: Boolean? = false): Map<String, Any?> =
        mapOf(
            "latitude" to latitude, "longitude" to longitude, "accuracyMeters" to accuracy,
            "capturedAt" to Instant.now().toString(), "provider" to "fused", "mock" to mock,
        )

    /** Sobre firmado de un marcaje. */
    protected fun envelope(
        p: Phone,
        cardPrint: String,
        observedAt: Instant,
        key: String = UUID.randomUUID().toString(),
        sequence: Int = ++p.sequence,
        session: String = p.session,
        declared: String? = null,
        location: Map<String, Any?>? = here(),
        scheme: String = "uid_sha256",
        signer: ECKey = p.key,
        kid: String = p.id,
        extra: Map<String, Any?> = emptyMap(),
    ): String {
        val payload = linkedMapOf<String, Any?>(
            "envelopeVersion" to 1, "idempotencyKey" to key, "sessionId" to session, "sequence" to sequence,
            "observedAt" to observedAt.toString(), "timeZone" to "America/Mexico_City",
            "card" to mapOf("scheme" to scheme, "proof" to cardPrint), "location" to location, "app" to mapOf("version" to "0.1.0"),
        )
        if (declared != null) payload["declaredType"] = declared
        payload.putAll(extra)
        return JWSObject(JWSHeader.Builder(JWSAlgorithm.ES256).keyID(kid).build(), Payload(json(payload)))
            .apply { sign(ECDSASigner(signer)) }.serialize()
    }

    protected fun submit(p: Phone, envelope: String, key: String?, token: String? = assertion(p)): Reply = call(
        "POST", "/api/v1/attendance-events", token, """{"envelope":"$envelope"}""",
        if (key == null) emptyMap() else mapOf("Idempotency-Key" to key),
    )

    protected fun mark(
        p: Phone,
        cardPrint: String,
        observedAt: Instant,
        declared: String? = null,
        location: Map<String, Any?>? = here(),
    ): Reply {
        val key = UUID.randomUUID().toString()
        return submit(p, envelope(p, cardPrint, observedAt, key, declared = declared, location = location), key)
    }

    /** JSON que conserva los nulos: el contrato distingue un campo nulo de uno ausente. */
    protected fun json(value: Any?): String = when (value) {
        null -> "null"
        is String -> "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
        is Number, is Boolean -> value.toString()
        is Map<*, *> -> value.entries.joinToString(",", "{", "}") { "${json(it.key.toString())}:${json(it.value)}" }
        is Iterable<*> -> value.joinToString(",", "[", "]") { json(it) }
        else -> error("Tipo sin soporte: ${value::class}")
    }
}
