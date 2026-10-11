package mx.fastsolution.zenit.capture

import mx.fastsolution.zenit.site.SiteRow
import java.time.Duration
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.util.UUID
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

data class LocationSample(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double,
    val capturedAt: OffsetDateTime,
    val provider: String?,
    val mock: Boolean?,
)

/** Carga del sobre firmado, ya validada contra el contrato. */
data class EnvelopePayload(
    val idempotencyKey: UUID,
    val sessionId: UUID,
    val sequence: Int,
    val observedAt: OffsetDateTime,
    val timeZone: String,
    val elapsedRealtimeMs: Long?,
    val declaredType: String?,
    val cardScheme: String,
    val cardProof: String,
    val location: LocationSample?,
    val appVersion: String,
)

class InvalidPayload(message: String) : RuntimeException(message)

/** Lee la carga de un sobre. No admite campos de más ni tipos distintos a los del contrato. */
object Envelopes {
    val TYPES = setOf("clock_in", "clock_out", "break_start", "break_end")
    const val SIMULATED_SCHEME = "uid_sha256"
    private val SCHEMES = setOf("desfire_ev3_aes", SIMULATED_SCHEME)
    private val UNAVAILABLE = setOf("permission_denied", "disabled", "timeout")
    private val TOP = setOf(
        "envelopeVersion", "idempotencyKey", "sessionId", "sequence", "observedAt", "timeZone", "elapsedRealtimeMs",
        "declaredType", "card", "location", "locationUnavailableReason", "integrityToken", "app",
    )
    private const val MAX_PROOF = 512

    fun parse(raw: Map<String, Any?>): EnvelopePayload {
        only(raw, TOP, "el sobre")
        if (whole(raw, "envelopeVersion") != 1L) fail("envelopeVersion debe ser 1")
        val sequence = whole(raw, "sequence") ?: fail("falta sequence")
        if (sequence < 1 || sequence > Int.MAX_VALUE) fail("sequence fuera de rango")
        val timeZone = text(raw, "timeZone") ?: fail("falta timeZone")
        if (timeZone !in ZoneId.getAvailableZoneIds()) fail("timeZone no es una zona IANA")
        val declared = text(raw, "declaredType")
        if (declared != null && declared !in TYPES) fail("declaredType no es un tipo de marcaje")
        val reason = text(raw, "locationUnavailableReason")
        if (reason != null && reason !in UNAVAILABLE) fail("locationUnavailableReason no es un motivo conocido")
        text(raw, "integrityToken")

        val card = map(raw, "card") ?: fail("falta card")
        only(card, setOf("scheme", "proof", "keyVersion"), "card")
        val scheme = text(card, "scheme") ?: fail("falta card.scheme")
        if (scheme !in SCHEMES) fail("card.scheme no es un esquema conocido")
        val proof = text(card, "proof") ?: fail("falta card.proof")
        if (proof.isEmpty() || proof.length > MAX_PROOF) fail("card.proof fuera de tamaño")
        whole(card, "keyVersion")

        val app = map(raw, "app") ?: fail("falta app")
        only(app, setOf("version"), "app")
        val version = text(app, "version") ?: fail("falta app.version")

        if (!raw.containsKey("location")) fail("falta location")
        return EnvelopePayload(
            idempotencyKey = uuid(raw, "idempotencyKey"),
            sessionId = uuid(raw, "sessionId"),
            sequence = sequence.toInt(),
            observedAt = instant(raw, "observedAt"),
            timeZone = timeZone,
            elapsedRealtimeMs = whole(raw, "elapsedRealtimeMs"),
            declaredType = declared,
            cardScheme = scheme,
            cardProof = proof,
            location = map(raw, "location")?.let(::location),
            appVersion = version,
        )
    }

    private fun location(raw: Map<String, Any?>): LocationSample {
        only(raw, setOf("latitude", "longitude", "accuracyMeters", "capturedAt", "provider", "mock"), "location")
        val latitude = decimal(raw, "latitude") ?: fail("falta location.latitude")
        val longitude = decimal(raw, "longitude") ?: fail("falta location.longitude")
        val accuracy = decimal(raw, "accuracyMeters") ?: fail("falta location.accuracyMeters")
        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0 || accuracy < 0 || accuracy.isNaN()) fail("location fuera de rango")
        val mock = raw["mock"]
        if (mock != null && mock !is Boolean) fail("location.mock debe ser booleano")
        return LocationSample(latitude, longitude, accuracy, instant(raw, "capturedAt"), text(raw, "provider"), mock as Boolean?)
    }

    private fun fail(message: String): Nothing = throw InvalidPayload(message)

    private fun only(raw: Map<String, Any?>, allowed: Set<String>, where: String) {
        val extra = raw.keys - allowed
        if (extra.isNotEmpty()) fail("campo no admitido en $where")
    }

    private fun text(raw: Map<String, Any?>, key: String): String? = when (val value = raw[key]) {
        null -> null
        is String -> value
        else -> fail("$key debe ser texto")
    }

    private fun whole(raw: Map<String, Any?>, key: String): Long? = when (val value = raw[key]) {
        null -> null
        is Number -> if (value.toDouble() == value.toLong().toDouble()) value.toLong() else fail("$key debe ser entero")
        else -> fail("$key debe ser entero")
    }

    private fun decimal(raw: Map<String, Any?>, key: String): Double? = when (val value = raw[key]) {
        null -> null
        is Number -> value.toDouble()
        else -> fail("$key debe ser número")
    }

    @Suppress("UNCHECKED_CAST")
    private fun map(raw: Map<String, Any?>, key: String): Map<String, Any?>? = when (val value = raw[key]) {
        null -> null
        is Map<*, *> -> value as Map<String, Any?>
        else -> fail("$key debe ser un objeto")
    }

    private fun uuid(raw: Map<String, Any?>, key: String): UUID = try {
        UUID.fromString(text(raw, key) ?: fail("falta $key"))
    } catch (e: IllegalArgumentException) {
        fail("$key debe ser un UUID")
    }

    private fun instant(raw: Map<String, Any?>, key: String): OffsetDateTime = try {
        OffsetDateTime.parse(text(raw, key) ?: fail("falta $key"))
    } catch (e: DateTimeParseException) {
        fail("$key debe ser un instante RFC 3339")
    }
}

data class LastMark(val type: String, val observedAt: OffsetDateTime)

data class MarkDecision(val type: String, val incidents: List<String>)

/**
 * El dispositivo declara y el servidor decide. Sin declaración, el tipo se
 * deduce de la marca anterior de la persona; una declaración válida lo
 * corrige. Nunca se pierde una marca: la que no cuadra se acepta y queda con
 * incidencia.
 */
object MarkRules {
    fun decide(
        breakPolicy: String,
        last: LastMark?,
        declared: String?,
        observedAt: OffsetDateTime,
        duplicateWindow: Duration,
        shiftGap: Duration,
    ): MarkDecision {
        val marked = breakPolicy == "marked"
        val sinceLast = last?.let { Duration.between(it.observedAt, observedAt) }
        // Dos lecturas seguidas son la misma marca, no una entrada y una salida.
        if (last != null && sinceLast != null && !sinceLast.isNegative && sinceLast <= duplicateWindow) {
            return MarkDecision(last.type, listOf("duplicate"))
        }
        val incidents = mutableListOf<String>()
        var open = last?.type?.takeIf { it != "clock_out" }
        if (open != null && sinceLast != null && sinceLast > shiftGap) {
            // La jornada anterior quedó sin salida; ésta empieza una nueva.
            incidents += "missing_pair"
            open = null
        }
        val expected = when (open) {
            null -> setOf("clock_in")
            "clock_in" -> if (marked) setOf("break_start", "clock_out") else setOf("clock_out")
            "break_start" -> setOf("break_end")
            else -> setOf("break_start", "clock_out")
        }
        val deduced = when (open) {
            null -> "clock_in"
            "clock_in" -> if (marked) "break_start" else "clock_out"
            "break_start" -> "break_end"
            else -> "clock_out"
        }
        // Donde la comida no se considera, declarar un descanso no cuenta.
        val admitted = if (marked) Envelopes.TYPES else setOf("clock_in", "clock_out")
        val type = if (declared != null && declared in admitted) declared else deduced
        if (type !in expected && "missing_pair" !in incidents) incidents += "missing_pair"
        return MarkDecision(type, incidents)
    }
}

/** Veredicto de ubicación contra la geocerca de una sede. */
object Geo {
    private const val EARTH_RADIUS_M = 6_371_000.0

    fun distanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
        return 2 * EARTH_RADIUS_M * asin(sqrt(a))
    }

    /**
     * Devuelve el veredicto y, si hace falta que alguien lo revise, la
     * incidencia. Una muestra menos precisa que el radio no se interpreta
     * como fuera: no es concluyente.
     */
    fun verdict(site: SiteRow?, sample: LocationSample?): Pair<String, String?> = when {
        site == null -> "not_evaluated" to null
        sample == null -> "not_evaluated" to "location_inconclusive"
        sample.mock == true || sample.accuracyMeters > site.radiusMeters -> "inconclusive" to "location_inconclusive"
        distanceMeters(site.latitude, site.longitude, sample.latitude, sample.longitude) <= site.radiusMeters -> "inside" to null
        else -> "outside" to "foreign_site"
    }
}
