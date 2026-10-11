package mx.fastsolution.zenit.capture

import com.nimbusds.jose.JWSObject
import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.card.CardRepository
import mx.fastsolution.zenit.device.CurrentDevice
import mx.fastsolution.zenit.device.DeviceKeys
import mx.fastsolution.zenit.device.DeviceRepository
import mx.fastsolution.zenit.employee.EmployeeRepository
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.site.SiteRepository
import mx.fastsolution.zenit.tenant.TenantRepository
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest
import java.text.ParseException
import java.time.Duration
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeParseException
import java.util.UUID
import kotlin.math.abs

data class EventRow(
    val id: UUID,
    val idempotencyKey: UUID,
    val type: String,
    val outcome: String,
    val observedAt: OffsetDateTime,
    val receivedAt: OffsetDateTime,
    val deviceId: UUID,
    val deviceMode: String,
    val employeeId: UUID,
    val siteId: UUID?,
    val locationVerdict: String,
    val accuracyMeters: Double?,
    val payloadSha256: String,
    /** Incidencias del marcaje, como pares de identificador y tipo. */
    val incidents: List<Pair<UUID, String>>,
)

data class RejectionRow(val code: String, val message: String, val observedAt: OffsetDateTime?, val receivedAt: OffsetDateTime, val payloadSha256: String)

data class ReceiptEmployee(val displayName: String)

data class ReceiptSite(val id: String, val name: String)

data class ReceiptIncident(val id: String, val type: String)

data class ReceiptRejection(val code: String, val message: String)

/** Lo que el dispositivo recibe por cada sobre: guardado, guardado con incidencia o rechazado. */
data class Receipt(
    val eventId: String?,
    val idempotencyKey: String,
    val outcome: String,
    val type: String?,
    val observedAt: String,
    val receivedAt: String,
    val employee: ReceiptEmployee?,
    val site: ReceiptSite?,
    val locationVerdict: String,
    val incident: ReceiptIncident?,
    val rejection: ReceiptRejection?,
)

data class Processed(val receipt: Receipt, val created: Boolean)

class EventSubmission {
    var envelope: String? = null
}

class BatchSubmission {
    var envelopes: List<String>? = null
}

data class BatchResult(val receipts: List<Receipt>)

/** Vista del portal: veredicto y precisión, nunca la coordenada. */
data class AttendanceEventView(
    val id: String,
    val employeeId: String,
    val siteId: String?,
    val deviceId: String,
    val deviceMode: String,
    val type: String,
    val outcome: String,
    val observedAt: String,
    val receivedAt: String,
    val delaySeconds: Long,
    val locationVerdict: String,
    val accuracyMeters: Double?,
    val incidentIds: List<String>,
    val payloadHash: String,
)

@Repository
class CaptureRepository(private val dsl: DSLContext) {
    fun findEvent(tenantId: UUID, idempotencyKey: UUID): EventRow? =
        dsl.fetchOne("$EVENT where e.tenant_id = ? and e.idempotency_key = ?", tenantId, idempotencyKey)?.let(::event)

    fun findRejection(tenantId: UUID, idempotencyKey: UUID): RejectionRow? =
        dsl.fetchOne(
            "select code, message, observed_at, received_at, cast(payload_sha256 as text) as payload_sha256 " +
                "from attendance_rejection where tenant_id = ? and idempotency_key = ?",
            tenantId, idempotencyKey,
        )?.let {
            RejectionRow(
                it.get("code", String::class.java), it.get("message", String::class.java),
                it.get("observed_at", OffsetDateTime::class.java), it.get("received_at", OffsetDateTime::class.java),
                it.get("payload_sha256", String::class.java).trim(),
            )
        }

    fun insertRejection(tenantId: UUID, key: UUID, deviceId: UUID, code: String, message: String, observedAt: OffsetDateTime?, receivedAt: OffsetDateTime, hash: String) {
        dsl.execute(
            "insert into attendance_rejection (tenant_id, id, idempotency_key, device_id, code, message, observed_at, received_at, payload_sha256) " +
                "values (?, ?, ?, ?, ?, ?, cast(? as timestamptz), cast(? as timestamptz), ?) " +
                "on conflict (tenant_id, idempotency_key) do nothing",
            tenantId, UUID.randomUUID(), key, deviceId, code, message, observedAt, receivedAt, hash,
        )
    }

    /** La marca más reciente de la persona, anterior o igual a ese instante. */
    fun lastMark(tenantId: UUID, employeeId: UUID, until: OffsetDateTime): LastMark? =
        dsl.fetchOne(
            "select event_type, observed_at from attendance_event where tenant_id = ? and employee_id = ? " +
                "and observed_at <= cast(? as timestamptz) order by observed_at desc, received_at desc limit 1",
            tenantId, employeeId, until,
        )?.let { LastMark(it.get("event_type", String::class.java), it.get("observed_at", OffsetDateTime::class.java)) }

    fun sequenceTaken(tenantId: UUID, sessionId: UUID, sequence: Int): Boolean =
        dsl.fetchOne(
            "select 1 as found from attendance_event where tenant_id = ? and session_id = ? and sequence = ?",
            tenantId, sessionId, sequence,
        ) != null

    /** El marcaje anterior de la sesión que trae reloj monotónico, para comparar los dos relojes. */
    fun previousClock(tenantId: UUID, sessionId: UUID, sequence: Int): Pair<OffsetDateTime, Long>? =
        dsl.fetchOne(
            "select observed_at, elapsed_realtime_ms from attendance_event where tenant_id = ? and session_id = ? " +
                "and sequence < ? and elapsed_realtime_ms is not null order by sequence desc limit 1",
            tenantId, sessionId, sequence,
        )?.let { it.get("observed_at", OffsetDateTime::class.java) to it.get("elapsed_realtime_ms", Number::class.java).toLong() }

    fun insertEvent(
        tenantId: UUID,
        id: UUID,
        payload: EnvelopePayload,
        type: String,
        outcome: String,
        receivedAt: OffsetDateTime,
        device: CurrentDevice,
        employeeId: UUID,
        cardId: UUID,
        siteId: UUID?,
        verdict: String,
        envelope: String,
        hash: String,
    ) {
        dsl.execute(
            "insert into attendance_event (tenant_id, id, idempotency_key, event_type, declared_type, outcome, observed_at, " +
                "received_at, time_zone, elapsed_realtime_ms, device_id, device_mode, session_id, sequence, employee_id, card_id, " +
                "card_scheme, site_id, location_verdict, accuracy_m, envelope, payload_sha256) values (?, ?, ?, ?, cast(? as text), ?, " +
                "cast(? as timestamptz), cast(? as timestamptz), ?, cast(? as bigint), ?, ?, ?, ?, ?, ?, ?, cast(? as uuid), ?, " +
                "cast(? as numeric), ?, ?)",
            tenantId, id, payload.idempotencyKey, type, payload.declaredType, outcome, payload.observedAt, receivedAt,
            payload.timeZone, payload.elapsedRealtimeMs, device.id, device.mode, payload.sessionId, payload.sequence, employeeId,
            cardId, payload.cardScheme, siteId, verdict, payload.location?.accuracyMeters, envelope, hash,
        )
        val sample = payload.location ?: return
        dsl.execute(
            "insert into location_evidence (tenant_id, event_id, latitude, longitude, accuracy_m, captured_at, provider, mock) " +
                "values (?, ?, cast(? as numeric), cast(? as numeric), cast(? as numeric), cast(? as timestamptz), cast(? as text), " +
                "cast(? as boolean))",
            tenantId, id, sample.latitude, sample.longitude, sample.accuracyMeters, sample.capturedAt, sample.provider, sample.mock,
        )
    }

    fun insertIncident(tenantId: UUID, id: UUID, eventId: UUID, employeeId: UUID, siteId: UUID?, type: String) {
        dsl.execute(
            "insert into incident (tenant_id, id, event_id, employee_id, site_id, type, status) " +
                "values (?, ?, ?, ?, cast(? as uuid), ?, 'open')",
            tenantId, id, eventId, employeeId, siteId, type,
        )
    }

    fun page(tenantId: UUID, employeeId: UUID?, siteId: UUID?, from: OffsetDateTime, to: OffsetDateTime, after: PageKey?, limit: Int): List<EventRow> {
        val sql = StringBuilder("$EVENT where e.tenant_id = ? and e.observed_at >= cast(? as timestamptz) and e.observed_at < cast(? as timestamptz)")
        val binds = mutableListOf<Any>(tenantId, from, to)
        if (employeeId != null) {
            sql.append(" and e.employee_id = ?")
            binds += employeeId
        }
        if (siteId != null) {
            sql.append(" and e.site_id = ?")
            binds += siteId
        }
        if (after != null) {
            sql.append(" and (e.observed_at, e.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by e.observed_at, e.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { event(it) }
    }

    private fun event(r: Record) = EventRow(
        id = r.get("id", UUID::class.java),
        idempotencyKey = r.get("idempotency_key", UUID::class.java),
        type = r.get("event_type", String::class.java),
        outcome = r.get("outcome", String::class.java),
        observedAt = r.get("observed_at", OffsetDateTime::class.java),
        receivedAt = r.get("received_at", OffsetDateTime::class.java),
        deviceId = r.get("device_id", UUID::class.java),
        deviceMode = r.get("device_mode", String::class.java),
        employeeId = r.get("employee_id", UUID::class.java),
        siteId = r.get("site_id", UUID::class.java),
        locationVerdict = r.get("location_verdict", String::class.java),
        accuracyMeters = r.get("accuracy_m", Number::class.java)?.toDouble(),
        payloadSha256 = r.get("payload_sha256", String::class.java).trim(),
        incidents = r.get("incidents", String::class.java).split(',').filter { it.isNotEmpty() }.map {
            val (id, type) = it.split('=', limit = 2)
            UUID.fromString(id) to type
        },
    )

    private companion object {
        const val EVENT =
            "select e.id, e.idempotency_key, e.event_type, e.outcome, e.observed_at, e.received_at, e.device_id, e.device_mode, " +
                "e.employee_id, e.site_id, e.location_verdict, e.accuracy_m, cast(e.payload_sha256 as text) as payload_sha256, " +
                "coalesce((select string_agg(cast(i.id as text) || '=' || i.type, ',' order by i.created_at, i.id) from incident i " +
                "where i.tenant_id = e.tenant_id and i.event_id = e.id), '') as incidents from attendance_event e"
    }
}

/** El sobre trae una clave ya usada con otro contenido. */
class IdempotencyConflict : RuntimeException()

/**
 * Procesa un sobre firmado. Cada sobre va en su propia transacción: en un lote,
 * el problema de uno no arrastra a los demás.
 */
@Service
class CaptureProcessor(
    private val events: CaptureRepository,
    private val devices: DeviceRepository,
    private val cards: CardRepository,
    private val employees: EmployeeRepository,
    private val sites: SiteRepository,
    private val tenants: TenantRepository,
    private val capture: CaptureProperties,
) {
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = [IdempotencyConflict::class])
    fun process(device: CurrentDevice, envelope: String, headerKey: UUID?): Processed {
        val tenantId = device.tenantId
        val receivedAt = OffsetDateTime.now(ZoneOffset.UTC)
        val hash = sha256(envelope)
        val jws = try {
            JWSObject.parse(envelope)
        } catch (e: ParseException) {
            null
        }
        val raw = jws?.payload?.toJSONObject()
        // Lo que se lee antes de verificar la firma sólo sirve para devolvérselo a quien lo mandó.
        val echoKey = headerKey ?: (raw?.get("idempotencyKey") as? String)?.let(::uuidOrNull)
        val echoObserved = (raw?.get("observedAt") as? String)?.let(::instantOrNull)

        fun reject(code: String, message: String): Processed {
            if (echoKey != null) {
                events.insertRejection(tenantId, echoKey, device.id, code, message, echoObserved, receivedAt, hash)
                // El recibo sale de lo guardado: repetir la clave devuelve exactamente el mismo.
                events.findRejection(tenantId, echoKey)?.let {
                    return Processed(rejection(echoKey, it.code, it.message, it.observedAt, it.receivedAt), created = false)
                }
            }
            return Processed(rejection(echoKey, code, message, echoObserved, receivedAt), created = false)
        }

        if (jws == null || raw == null) return reject("payload_invalid", "El sobre no es un JWS con carga JSON.")
        val stored = devices.find(tenantId, device.id) ?: return reject("signature_invalid", "El dispositivo no existe.")
        if (jws.header.keyID != device.id.toString() || !DeviceKeys.verify(jws, DeviceKeys.parseStored(stored.publicJwk))) {
            return reject("signature_invalid", "El sobre no está firmado por este dispositivo.")
        }
        val payload = try {
            Envelopes.parse(raw)
        } catch (e: InvalidPayload) {
            return reject("payload_invalid", "La carga no cumple el contrato: ${e.message}.")
        }
        if (headerKey != null && headerKey != payload.idempotencyKey) {
            throw Problems.validation("Idempotency-Key", "key_mismatch", "La cabecera y la clave firmada en el sobre no coinciden.")
        }

        // La misma clave devuelve el mismo recibo; con otro contenido no se acepta.
        events.findEvent(tenantId, payload.idempotencyKey)?.let {
            if (it.payloadSha256 != hash) throw IdempotencyConflict()
            return Processed(receipt(tenantId, it), created = false)
        }
        events.findRejection(tenantId, payload.idempotencyKey)?.let {
            if (it.payloadSha256 != hash) throw IdempotencyConflict()
            return Processed(rejection(payload.idempotencyKey, it.code, it.message, it.observedAt, it.receivedAt), created = false)
        }

        val session = devices.findSession(tenantId, device.id, payload.sessionId)
            ?: return reject("session_invalid", "La sesión no es de este dispositivo.")
        val offline = Duration.ofHours(capture.offlineMaxAgeHours)
        if (payload.sequence > capture.offlineMaxEvents || payload.observedAt > session.startedAt.plus(offline)) {
            return reject("session_invalid", "La sesión excedió lo que vale sin conexión.")
        }
        if (events.sequenceTaken(tenantId, payload.sessionId, payload.sequence)) {
            return reject("session_invalid", "Ese consecutivo ya se usó en la sesión.")
        }
        if (Duration.between(payload.observedAt, receivedAt) > offline) {
            return reject("too_old", "El marcaje es más viejo de lo que se acepta.")
        }

        if (payload.cardScheme != Envelopes.SIMULATED_SCHEME) {
            return reject("card_unknown", "El servidor todavía no verifica ese esquema de tarjeta.")
        }
        if (!capture.simulatedCards) return reject("card_unknown", "Este ambiente no acepta la tarjeta simulada.")
        val card = cards.findByFingerprint(tenantId, payload.cardProof) ?: return reject("card_unknown", "La tarjeta no está registrada.")
        if (card.status in NEVER_HELD) return reject("card_unknown", "La tarjeta no tiene titular.")
        val holder = card.employeeId
        if (card.status != "active" || holder == null) return reject("card_revoked", "La tarjeta ya no está activa.")
        // Las marcas de una persona se procesan de una en una.
        if (!employees.lock(tenantId, holder)) return reject("card_unknown", "La tarjeta no tiene titular.")
        val employee = employees.find(tenantId, holder)!!
        if (employee.status != "active") return reject("card_revoked", "La persona titular está dada de baja.")
        if (device.mode == "personal" && device.employeeId != employee.id) {
            return reject("card_not_owner", "Este teléfono sólo acepta la tarjeta de su titular.")
        }

        val tenant = tenants.find(tenantId)!!
        val decision = MarkRules.decide(
            tenant.breakPolicy, events.lastMark(tenantId, employee.id, payload.observedAt), payload.declaredType, payload.observedAt,
            Duration.ofSeconds(capture.duplicateWindowSeconds), Duration.ofHours(capture.shiftGapHours),
        )
        // Una terminal se evalúa contra su sede; un teléfono personal, contra la sede de su titular.
        val site = (device.siteId ?: employee.siteId)?.let { sites.find(tenantId, it) }
        val (verdict, locationIncident) = Geo.verdict(site, payload.location)
        val incidents = linkedSetOf<String>()
        incidents += decision.incidents
        locationIncident?.let { incidents += it }
        if (device.mode == "terminal" && employee.siteId != null && employee.siteId != device.siteId) incidents += "foreign_site"
        if (Duration.between(payload.observedAt, receivedAt) > Duration.ofHours(capture.lateSyncHours)) incidents += "late_sync"
        if (clockAnomaly(tenantId, payload, receivedAt)) incidents += "clock_anomaly"

        val eventId = UUID.randomUUID()
        val outcome = if (incidents.isEmpty()) "accepted" else "accepted_with_incident"
        events.insertEvent(
            tenantId, eventId, payload, decision.type, outcome, receivedAt, device, employee.id, card.id, site?.id, verdict, envelope, hash,
        )
        incidents.forEach { events.insertIncident(tenantId, UUID.randomUUID(), eventId, employee.id, site?.id, it) }
        devices.touch(tenantId, device.id, payload.appVersion)
        return Processed(receipt(tenantId, events.findEvent(tenantId, payload.idempotencyKey)!!), created = true)
    }

    /** La hora del dispositivo se adelanta al servidor, o sus dos relojes no avanzan igual. */
    private fun clockAnomaly(tenantId: UUID, payload: EnvelopePayload, receivedAt: OffsetDateTime): Boolean {
        val tolerance = Duration.ofSeconds(capture.futureToleranceSeconds)
        if (Duration.between(receivedAt, payload.observedAt) > tolerance) return true
        val elapsed = payload.elapsedRealtimeMs ?: return false
        val (previousAt, previousElapsed) = events.previousClock(tenantId, payload.sessionId, payload.sequence) ?: return false
        // Un reinicio del teléfono regresa el reloj monotónico a cero: no es anomalía.
        if (elapsed < previousElapsed) return false
        val wall = Duration.between(previousAt, payload.observedAt).toMillis()
        return abs(wall - (elapsed - previousElapsed)) > tolerance.toMillis()
    }

    private fun receipt(tenantId: UUID, event: EventRow): Receipt {
        val employee = employees.find(tenantId, event.employeeId)
        val site = event.siteId?.let { sites.find(tenantId, it) }
        return Receipt(
            eventId = event.id.toString(),
            idempotencyKey = event.idempotencyKey.toString(),
            outcome = event.outcome,
            type = event.type,
            observedAt = event.observedAt.toInstant().toString(),
            receivedAt = event.receivedAt.toInstant().toString(),
            employee = employee?.let { ReceiptEmployee(it.displayName) },
            site = site?.let { ReceiptSite(it.id.toString(), it.name) },
            locationVerdict = event.locationVerdict,
            incident = event.incidents.firstOrNull()?.let { ReceiptIncident(it.first.toString(), it.second) },
            rejection = null,
        )
    }

    private fun rejection(key: UUID?, code: String, message: String, observedAt: OffsetDateTime?, receivedAt: OffsetDateTime) = Receipt(
        eventId = null,
        // Un sobre ilegible no trae clave que devolver.
        idempotencyKey = (key ?: NO_KEY).toString(),
        outcome = "rejected",
        type = null,
        observedAt = (observedAt ?: receivedAt).toInstant().toString(),
        receivedAt = receivedAt.toInstant().toString(),
        employee = null,
        site = null,
        locationVerdict = "not_evaluated",
        incident = null,
        rejection = ReceiptRejection(code, message),
    )

    private fun uuidOrNull(text: String): UUID? = try {
        UUID.fromString(text)
    } catch (e: IllegalArgumentException) {
        null
    }

    private fun instantOrNull(text: String): OffsetDateTime? = try {
        OffsetDateTime.parse(text)
    } catch (e: DateTimeParseException) {
        null
    }

    private fun sha256(text: String): String =
        MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }

    private companion object {
        val NO_KEY: UUID = UUID(0, 0)
        val NEVER_HELD = setOf("inventory", "assigned")
    }
}

@Service
class CaptureService(
    private val processor: CaptureProcessor,
    private val events: CaptureRepository,
    private val capture: CaptureProperties,
) {
    private val requests = FixedWindowLimiter(Duration.ofMinutes(1))

    fun submit(device: CurrentDevice, idempotencyKey: String?, body: EventSubmission): Processed {
        quota(device)
        val checks = Checks()
        val key = checks.uuid("Idempotency-Key", idempotencyKey, required = true)
        val envelope = body.envelope?.takeIf { COMPACT_JWS.matches(it) }
        if (envelope == null) checks.fail("envelope", "invalid_envelope", "Debe ser un JWS compacto.")
        checks.done()
        return try {
            processor.process(device, envelope!!, key!!)
        } catch (e: IdempotencyConflict) {
            throw Problems.conflict("idempotency_conflict", "La clave de idempotencia ya se usó con otro contenido.")
        }
    }

    /** Un recibo por sobre, en el mismo orden. */
    fun batch(device: CurrentDevice, body: BatchSubmission): BatchResult {
        quota(device)
        val envelopes = body.envelopes
        if (envelopes.isNullOrEmpty() || envelopes.size > MAX_BATCH || envelopes.any { !COMPACT_JWS.matches(it) }) {
            throw Problems.validation("envelopes", "invalid_batch", "Lleva de 1 a $MAX_BATCH sobres en formato JWS compacto.")
        }
        return BatchResult(
            envelopes.map {
                try {
                    processor.process(device, it, null).receipt
                } catch (e: IdempotencyConflict) {
                    conflictReceipt()
                }
            },
        )
    }

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, employeeId: String?, siteId: String?, from: String?, to: String?, after: PageKey?, limit: Int): List<EventRow> {
        val checks = Checks()
        val employee = checks.uuid("employeeId", employeeId, required = false)
        val site = checks.uuid("siteId", siteId, required = false)
        val start = instant(checks, "from", from)
        val end = instant(checks, "to", to)
        if (start != null && end != null && end <= start) checks.fail("to", "before_start", "Debe ser posterior a from.")
        checks.done()
        return events.page(person.requireTenant(), employee, site, start!!, end!!, after, limit + 1)
    }

    private fun quota(device: CurrentDevice) {
        if (!requests.tryAcquire(device.id.toString(), capture.deviceRequestsPerMinute)) throw Problems.rateLimited()
    }

    private fun instant(checks: Checks, field: String, raw: String?): OffsetDateTime? {
        if (raw.isNullOrBlank()) {
            checks.fail(field, "required", "Es obligatorio.")
            return null
        }
        return try {
            OffsetDateTime.parse(raw)
        } catch (e: DateTimeParseException) {
            checks.fail(field, "invalid_date_time", "Debe ser un instante RFC 3339.")
            null
        }
    }

    /** En un lote no hay 409: la clave repetida con otro contenido se rechaza con su recibo. */
    private fun conflictReceipt(): Receipt {
        val now = OffsetDateTime.now(ZoneOffset.UTC).toInstant().toString()
        return Receipt(
            null, UUID(0, 0).toString(), "rejected", null, now, now, null, null, "not_evaluated", null,
            ReceiptRejection("payload_invalid", "La clave de idempotencia ya se usó con otro contenido."),
        )
    }

    private companion object {
        const val MAX_BATCH = 100
        val COMPACT_JWS = Regex("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$")
    }
}

@RestController
@RequestMapping("/api/v1/attendance-events")
class CaptureController(private val service: CaptureService) {
    /** 201 cuando el marcaje queda guardado; 200 cuando se repite una clave o cuando se rechaza con recibo. */
    @PostMapping
    fun submit(
        @AuthenticationPrincipal device: CurrentDevice,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: EventSubmission,
    ): ResponseEntity<Receipt> {
        val processed = service.submit(device, idempotencyKey, body)
        return ResponseEntity.status(if (processed.created) HttpStatus.CREATED else HttpStatus.OK).body(processed.receipt)
    }

    @PostMapping("/batch")
    fun batch(@AuthenticationPrincipal device: CurrentDevice, @RequestBody body: BatchSubmission): BatchResult = service.batch(device, body)

    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam employeeId: String?,
        @RequestParam siteId: String?,
        @RequestParam from: String?,
        @RequestParam to: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<AttendanceEventView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, employeeId, siteId, from, to, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.observedAt, it.id) }) {
            AttendanceEventView(
                id = it.id.toString(),
                employeeId = it.employeeId.toString(),
                siteId = it.siteId?.toString(),
                deviceId = it.deviceId.toString(),
                deviceMode = it.deviceMode,
                type = it.type,
                outcome = it.outcome,
                observedAt = it.observedAt.toInstant().toString(),
                receivedAt = it.receivedAt.toInstant().toString(),
                delaySeconds = Duration.between(it.observedAt, it.receivedAt).seconds,
                locationVerdict = it.locationVerdict,
                accuracyMeters = it.accuracyMeters,
                incidentIds = it.incidents.map { incident -> incident.first.toString() },
                payloadHash = it.payloadSha256,
            )
        }
    }
}
