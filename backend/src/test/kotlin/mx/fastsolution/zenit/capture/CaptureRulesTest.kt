package mx.fastsolution.zenit.capture

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import mx.fastsolution.zenit.device.DeviceKeys
import mx.fastsolution.zenit.device.EnrollmentCodes
import mx.fastsolution.zenit.site.SiteRow
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.Date
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MarkRulesTest {
    private val start = OffsetDateTime.parse("2026-10-05T14:00:00Z")
    private val window = Duration.ofSeconds(60)
    private val gap = Duration.ofHours(16)

    private fun decide(policy: String, last: Pair<String, Long>?, declared: String? = null, minutesLater: Long = 120) = MarkRules.decide(
        policy, last?.let { LastMark(it.first, start.minusMinutes(minutesLater - it.second)) }, declared, start, window, gap,
    )

    @Test
    fun `without a break policy a person alternates entry and exit`() {
        assertEquals(MarkDecision("clock_in", emptyList()), decide("not_considered", null))
        assertEquals(MarkDecision("clock_out", emptyList()), decide("not_considered", "clock_in" to 0))
        assertEquals(MarkDecision("clock_in", emptyList()), decide("not_considered", "clock_out" to 0))
        // Declarar un descanso donde la comida no se considera no cuenta.
        assertEquals(MarkDecision("clock_out", emptyList()), decide("not_considered", "clock_in" to 0, declared = "break_start"))
    }

    @Test
    fun `with a marked break the order is entry, break, back and exit`() {
        assertEquals("clock_in", decide("marked", null).type)
        assertEquals("break_start", decide("marked", "clock_in" to 0).type)
        assertEquals("break_end", decide("marked", "break_start" to 0).type)
        assertEquals("clock_out", decide("marked", "break_end" to 0).type)
        // Quien se va sin tomar descanso lo declara, y es válido.
        assertEquals(MarkDecision("clock_out", emptyList()), decide("marked", "clock_in" to 0, declared = "clock_out"))
        assertEquals(MarkDecision("break_start", emptyList()), decide("marked", "break_end" to 0, declared = "break_start"))
    }

    @Test
    fun `a mark that does not fit is kept and flagged, never dropped`() {
        assertEquals(MarkDecision("clock_out", listOf("missing_pair")), decide("not_considered", null, declared = "clock_out"))
        assertEquals(MarkDecision("clock_in", listOf("missing_pair")), decide("not_considered", "clock_in" to 0, declared = "clock_in"))
        assertEquals(MarkDecision("clock_out", listOf("missing_pair")), decide("marked", "break_start" to 0, declared = "clock_out"))
    }

    @Test
    fun `two readings in a row are one mark, and a forgotten exit starts a new shift`() {
        val last = LastMark("clock_in", start.minusSeconds(30))
        assertEquals(MarkDecision("clock_in", listOf("duplicate")), MarkRules.decide("not_considered", last, null, start, window, gap))
        assertEquals(MarkDecision("clock_in", listOf("duplicate")), MarkRules.decide("not_considered", last, "clock_out", start, window, gap))

        val yesterday = LastMark("clock_in", start.minusHours(20))
        assertEquals(MarkDecision("clock_in", listOf("missing_pair")), MarkRules.decide("not_considered", yesterday, null, start, window, gap))
        val closed = LastMark("clock_out", start.minusHours(20))
        assertEquals(MarkDecision("clock_in", emptyList()), MarkRules.decide("not_considered", closed, null, start, window, gap))
    }
}

class GeoTest {
    private val site = SiteRow(UUID.randomUUID(), "Sede", "America/Mexico_City", 19.432608, -99.133209, 80, "active", OffsetDateTime.now())

    private fun sample(latitude: Double = 19.432608, longitude: Double = -99.133209, accuracy: Double = 10.0, mock: Boolean? = false) =
        LocationSample(latitude, longitude, accuracy, OffsetDateTime.now(), "fused", mock)

    @Test
    fun `measures the distance between two points`() {
        // Un grado de latitud son unos 111 km.
        assertEquals(111_195.0, Geo.distanceMeters(19.0, -99.0, 20.0, -99.0), 100.0)
        assertEquals(0.0, Geo.distanceMeters(19.4, -99.1, 19.4, -99.1), 0.001)
    }

    @Test
    fun `a sample less precise than the radius is inconclusive, not outside`() {
        assertEquals("inside" to null, Geo.verdict(site, sample()))
        assertEquals("inside" to null, Geo.verdict(site, sample(latitude = 19.433100)))
        assertEquals("outside" to "foreign_site", Geo.verdict(site, sample(latitude = 19.440000)))
        assertEquals("inconclusive" to "location_inconclusive", Geo.verdict(site, sample(latitude = 19.440000, accuracy = 200.0)))
        assertEquals("inconclusive" to "location_inconclusive", Geo.verdict(site, sample(mock = true)))
        assertEquals("not_evaluated" to "location_inconclusive", Geo.verdict(site, null))
        assertEquals("not_evaluated" to null, Geo.verdict(null, sample()))
    }
}

class EnvelopesTest {
    private fun payload(vararg changes: Pair<String, Any?>): Map<String, Any?> = mapOf(
        "envelopeVersion" to 1L,
        "idempotencyKey" to "2d4f6a8c-0e2b-4d6f-8a0c-2e4b6d8f0a2c",
        "sessionId" to "6f8a0c2e-4b6d-4f8a-9c0e-2b4d6f8a0c2e",
        "sequence" to 3L,
        "observedAt" to "2026-10-05T13:00:00Z",
        "timeZone" to "America/Mexico_City",
        "card" to mapOf("scheme" to "uid_sha256", "proof" to "huella-de-ejemplo"),
        "location" to mapOf("latitude" to 19.4, "longitude" to -99.1, "accuracyMeters" to 12L, "capturedAt" to "2026-10-05T12:59:58Z"),
        "app" to mapOf("version" to "0.1.0"),
    ) + changes

    @Test
    fun `reads a payload that follows the contract`() {
        val read = Envelopes.parse(payload("declaredType" to "clock_in", "elapsedRealtimeMs" to 123456L))

        assertEquals(3, read.sequence)
        assertEquals("uid_sha256", read.cardScheme)
        assertEquals("clock_in", read.declaredType)
        assertEquals(12.0, read.location?.accuracyMeters)
        assertNull(Envelopes.parse(payload("location" to null)).location)
    }

    @Test
    fun `rejects extra fields, missing fields and wrong types`() {
        val broken = listOf(
            payload("tenantId" to "otro"),
            payload("envelopeVersion" to 2L),
            payload("sequence" to 0L),
            payload("sequence" to "3"),
            payload("observedAt" to "ayer"),
            payload("timeZone" to "Marte/Olimpo"),
            payload("declaredType" to "comida"),
            payload("card" to mapOf("scheme" to "otro", "proof" to "x")),
            payload("card" to mapOf("scheme" to "uid_sha256", "proof" to "x", "uid" to "04AABB")),
            payload("location" to mapOf("latitude" to 91.0, "longitude" to 0.0, "accuracyMeters" to 1.0, "capturedAt" to "2026-10-05T12:59:58Z")),
            payload("app" to mapOf<String, Any?>()),
            payload() - "location",
            payload() - "card",
        )
        for (raw in broken) assertFailsWith<InvalidPayload>(raw.toString()) { Envelopes.parse(raw) }
    }
}

class DeviceKeysTest {
    private val key: ECKey = ECKeyGenerator(Curve.P_256).generate()
    private val deviceId = UUID.randomUUID()
    private val now = Instant.parse("2026-10-05T13:00:00Z")
    private val maxAge = Duration.ofSeconds(120)
    private val skew = Duration.ofSeconds(60)

    private fun assertion(
        issuer: String = deviceId.toString(),
        audience: String = "zenit-capture",
        issuedAt: Instant = now,
        lifetime: Long = 60,
        signer: ECKey = key,
    ): SignedJWT {
        val claims = JWTClaimsSet.Builder().issuer(issuer).subject(issuer).audience(audience)
            .issueTime(Date.from(issuedAt)).expirationTime(Date.from(issuedAt.plusSeconds(lifetime))).build()
        return SignedJWT(JWSHeader(JWSAlgorithm.ES256), claims).apply { sign(ECDSASigner(signer)) }
    }

    private fun valid(jwt: SignedJWT) = DeviceKeys.validAssertion(jwt, key.toPublicJWK(), deviceId, "zenit-capture", maxAge, skew, now)

    @Test
    fun `accepts a short assertion signed by the device for this service`() {
        assertTrue(valid(assertion()))
        assertTrue(valid(assertion(issuedAt = now.minusSeconds(90))))
    }

    @Test
    fun `rejects another signer, another device, another audience, an old or a long lived assertion`() {
        assertFalse(valid(assertion(signer = ECKeyGenerator(Curve.P_256).generate())))
        assertFalse(valid(assertion(issuer = UUID.randomUUID().toString())))
        assertFalse(valid(assertion(audience = "zenit-api")))
        assertFalse(valid(assertion(issuedAt = now.minusSeconds(600))))
        assertFalse(valid(assertion(issuedAt = now.plusSeconds(600))))
        assertFalse(valid(assertion(lifetime = 3600)))
    }

    @Test
    fun `only reads a public p-256 key`() {
        assertNotNull(DeviceKeys.parsePublic(key.toPublicJWK().toJSONObject()))
        // Una clave que trae su parte privada no se registra.
        assertNull(DeviceKeys.parsePublic(key.toJSONObject()))
        assertNull(DeviceKeys.parsePublic(ECKeyGenerator(Curve.P_384).generate().toPublicJWK().toJSONObject()))
        assertNull(DeviceKeys.parsePublic(mapOf("kty" to "EC", "crv" to "P-256")))
    }
}

class EnrollmentCodesTest {
    @Test
    fun `a code is easy to type and its hash ignores case, spaces and the hyphen`() {
        val code = EnrollmentCodes.generate()

        assertTrue(Regex("^[A-HJKMNP-TV-Z2-9]{5}-[A-HJKMNP-TV-Z2-9]{5}$").matches(code), code)
        assertEquals(EnrollmentCodes.hash(code), EnrollmentCodes.hash(" ${code.lowercase().replace("-", " ")} "))
        assertFalse(EnrollmentCodes.hash(code) == EnrollmentCodes.hash(EnrollmentCodes.generate()))
    }
}

class FixedWindowLimiterTest {
    private class MovableClock(var now: Instant) : Clock() {
        override fun instant(): Instant = now

        override fun getZone(): ZoneId = ZoneId.of("UTC")

        override fun withZone(zone: ZoneId): Clock = this
    }

    @Test
    fun `allows up to the limit per key and starts over in the next window`() {
        val clock = MovableClock(Instant.parse("2026-10-05T13:00:00Z"))
        val limiter = FixedWindowLimiter(Duration.ofMinutes(1), clock)

        assertFalse(limiter.exhausted("a", 2))
        assertTrue(limiter.tryAcquire("a", 2))
        assertTrue(limiter.tryAcquire("a", 2))
        assertTrue(limiter.exhausted("a", 2))
        assertFalse(limiter.tryAcquire("a", 2))
        // Cada clave lleva su propia cuenta.
        assertTrue(limiter.tryAcquire("b", 2))

        clock.now = clock.now.plusSeconds(61)
        assertFalse(limiter.exhausted("a", 2))
        assertTrue(limiter.tryAcquire("a", 2))
    }
}
