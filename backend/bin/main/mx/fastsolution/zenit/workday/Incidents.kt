package mx.fastsolution.zenit.workday

import com.fasterxml.jackson.annotation.JsonInclude
import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.capture.Envelopes
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.tenant.TenantRepository
import mx.fastsolution.zenit.user.UserRepository
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.util.UUID

data class IncidentRow(
    val id: UUID,
    val type: String,
    val severity: String,
    val status: String,
    val employeeId: UUID,
    val siteId: UUID?,
    val eventId: UUID,
    val eventAt: OffsetDateTime,
    val openedAt: OffsetDateTime,
    val assigneeUserId: UUID?,
    val decision: String?,
    val reason: String?,
    val resolvedBy: UUID?,
    val resolvedAt: OffsetDateTime?,
    val adjustment: AdjustmentView?,
)

/** Sólo lleva lo que su clase de ajuste usa. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class AdjustmentView(val kind: String, val eventId: String?, val eventType: String?, val occurredAt: String?)

data class ResolutionView(val decision: String, val reason: String, val adjustment: AdjustmentView?, val resolvedBy: String, val resolvedAt: String)

data class IncidentView(
    val id: String,
    val type: String,
    val severity: String,
    val status: String,
    val employeeId: String?,
    val siteId: String?,
    val eventIds: List<String>,
    val openedAt: String,
    val assigneeUserId: String?,
    val resolution: ResolutionView?,
) {
    companion object {
        fun of(row: IncidentRow) = IncidentView(
            id = row.id.toString(),
            type = row.type,
            severity = row.severity,
            status = row.status,
            employeeId = row.employeeId.toString(),
            siteId = row.siteId?.toString(),
            eventIds = listOf(row.eventId.toString()),
            openedAt = row.openedAt.toInstant().toString(),
            assigneeUserId = row.assigneeUserId?.toString(),
            resolution = if (row.decision != null && row.reason != null && row.resolvedBy != null && row.resolvedAt != null) {
                ResolutionView(row.decision, row.reason, row.adjustment, row.resolvedBy.toString(), row.resolvedAt.toInstant().toString())
            } else {
                null
            },
        )
    }
}

@Repository
class IncidentRepository(private val dsl: DSLContext) {
    fun find(tenantId: UUID, id: UUID): IncidentRow? = dsl.fetchOne("$SELECT where i.tenant_id = ? and i.id = ?", tenantId, id)?.let(::row)

    /** Pone en fila los cambios sobre una misma incidencia. */
    fun lock(tenantId: UUID, id: UUID): Boolean =
        dsl.fetchOne("select id from incident where tenant_id = ? and id = ? for update", tenantId, id) != null

    fun page(tenantId: UUID, status: String?, type: String?, siteId: UUID?, week: Pair<OffsetDateTime, OffsetDateTime>?, after: PageKey?, limit: Int): List<IncidentRow> {
        val sql = StringBuilder("$SELECT where i.tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (status != null) {
            sql.append(" and i.status = ?")
            binds += status
        }
        if (type != null) {
            sql.append(" and i.type = ?")
            binds += type
        }
        if (siteId != null) {
            sql.append(" and i.site_id = ?")
            binds += siteId
        }
        if (week != null) {
            sql.append(" and e.observed_at >= cast(? as timestamptz) and e.observed_at < cast(? as timestamptz)")
            binds += week.first
            binds += week.second
        }
        if (after != null) {
            sql.append(" and (i.created_at, i.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by i.created_at, i.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { row(it) }
    }

    fun assign(tenantId: UUID, id: UUID, assignee: UUID?) {
        dsl.execute("update incident set assignee_user_id = cast(? as uuid) where tenant_id = ? and id = ?", assignee, tenantId, id)
    }

    fun resolve(tenantId: UUID, id: UUID, decision: String, reason: String, adjustmentId: UUID?, resolvedBy: UUID) {
        dsl.execute(
            "update incident set status = 'resolved', resolution_decision = ?, resolution_reason = ?, adjustment_id = cast(? as uuid), " +
                "resolved_by = ?, resolved_at = now() where tenant_id = ? and id = ?",
            decision, reason, adjustmentId, resolvedBy, tenantId, id,
        )
    }

    fun insertAdjustment(tenantId: UUID, id: UUID, employeeId: UUID, kind: String, eventId: UUID?, eventType: String?, occurredAt: OffsetDateTime?, reason: String, author: String) {
        dsl.execute(
            "insert into adjustment (tenant_id, id, employee_id, kind, event_id, event_type, occurred_at, reason, created_by) " +
                "values (?, ?, ?, ?, cast(? as uuid), cast(? as text), cast(? as timestamptz), ?, ?)",
            tenantId, id, employeeId, kind, eventId, eventType, occurredAt, reason, author,
        )
    }

    /** Hora de un marcaje de esa persona; nulo si el marcaje no es suyo. */
    fun eventTime(tenantId: UUID, employeeId: UUID, eventId: UUID): OffsetDateTime? =
        dsl.fetchOne(
            "select observed_at from attendance_event where tenant_id = ? and employee_id = ? and id = ?", tenantId, employeeId, eventId,
        )?.get("observed_at", OffsetDateTime::class.java)

    fun weekIsClosed(tenantId: UUID, employeeId: UUID, weekStart: LocalDate): Boolean =
        dsl.fetchOne(
            "select 1 as found from week_closure where tenant_id = ? and employee_id = ? and week_start = cast(? as date) and status = 'closed'",
            tenantId, employeeId, weekStart.toString(),
        ) != null

    private fun row(r: Record) = IncidentRow(
        id = r.get("id", UUID::class.java),
        type = r.get("type", String::class.java),
        severity = r.get("severity", String::class.java),
        status = r.get("status", String::class.java),
        employeeId = r.get("employee_id", UUID::class.java),
        siteId = r.get("site_id", UUID::class.java),
        eventId = r.get("event_id", UUID::class.java),
        eventAt = r.get("observed_at", OffsetDateTime::class.java),
        openedAt = r.get("created_at", OffsetDateTime::class.java),
        assigneeUserId = r.get("assignee_user_id", UUID::class.java),
        decision = r.get("resolution_decision", String::class.java),
        reason = r.get("resolution_reason", String::class.java),
        resolvedBy = r.get("resolved_by", UUID::class.java),
        resolvedAt = r.get("resolved_at", OffsetDateTime::class.java),
        adjustment = r.get("adjustment_kind", String::class.java)?.let {
            AdjustmentView(
                it, r.get("adjustment_event_id", UUID::class.java)?.toString(), r.get("adjustment_event_type", String::class.java),
                r.get("adjustment_occurred_at", OffsetDateTime::class.java)?.toInstant()?.toString(),
            )
        },
    )

    private companion object {
        const val SELECT =
            "select i.id, i.type, i.severity, i.status, i.employee_id, i.site_id, i.event_id, e.observed_at, i.created_at, " +
                "i.assignee_user_id, i.resolution_decision, i.resolution_reason, i.resolved_by, i.resolved_at, " +
                "a.kind as adjustment_kind, a.event_id as adjustment_event_id, a.event_type as adjustment_event_type, " +
                "a.occurred_at as adjustment_occurred_at from incident i " +
                "join attendance_event e on e.tenant_id = i.tenant_id and e.id = i.event_id " +
                "left join adjustment a on a.tenant_id = i.tenant_id and a.id = i.adjustment_id"
    }
}

/**
 * Una incidencia no sanciona a nadie: es algo que una persona autorizada
 * revisa. La resuelve justificándola, confirmándola o ajustando la jornada, y
 * en los tres casos deja su motivo. Un ajuste no edita el marcaje.
 */
@Service
class IncidentService(
    private val incidents: IncidentRepository,
    private val users: UserRepository,
    private val tenants: TenantRepository,
    private val audit: AuditLog,
) {
    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, status: String?, type: String?, siteId: String?, week: String?, after: PageKey?, limit: Int): List<IncidentRow> {
        val tenantId = person.requireTenant()
        val checks = Checks()
        checks.oneOf("status", status, STATUSES, required = false)
        checks.oneOf("type", type, TYPES, required = false)
        val site = checks.uuid("siteId", siteId, required = false)
        val date = checks.date("week", week, required = false)
        checks.done()
        val range = date?.let { weekRange(tenantId, it) }
        return incidents.page(tenantId, status, type, site, range, after, limit + 1)
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): IncidentRow = incidents.find(person.requireTenant(), id) ?: throw Problems.notFound()

    /**
     * Asigna o resuelve. El cuerpo llega como mapa porque `assigneeUserId` en
     * nulo quita la asignación, que no es lo mismo que no mandarlo.
     */
    @Transactional
    fun update(person: CurrentPerson, id: UUID, body: Map<String, Any?>): IncidentRow {
        val tenantId = person.requireTenant()
        val resolver = person.userId ?: throw Problems.forbidden()
        val checks = Checks()
        (body.keys - setOf("assigneeUserId", "resolution")).forEach { checks.fail(it, "unknown_field", "Ese campo no se puede cambiar.") }
        if (body.isEmpty()) checks.fail("", "empty_update", "Hay que cambiar al menos un campo.")
        val assigneeRaw = body["assigneeUserId"]
        if (assigneeRaw != null && assigneeRaw !is String) checks.fail("assigneeUserId", "invalid_value", "Debe ser texto.")
        val assignee = checks.uuid("assigneeUserId", assigneeRaw as? String, required = false)
        val resolution = resolution(checks, body)
        checks.done()

        if (!incidents.lock(tenantId, id)) throw Problems.notFound()
        val before = incidents.find(tenantId, id)!!
        if (before.status != "open") throw Problems.conflict("incident_already_resolved", "La incidencia ya está resuelta.")

        if ("assigneeUserId" in body) {
            if (assignee != null && users.find(tenantId, assignee)?.takeIf { it.status != "disabled" } == null) {
                throw Problems.validation("assigneeUserId", "user_not_found", "Esa persona no tiene acceso vigente a la empresa.")
            }
            incidents.assign(tenantId, id, assignee)
            audit.record(tenantId, person, "incident.assigned", "incident", id, mapOf("assigned" to (assignee != null).toString()))
        }
        if (resolution != null) {
            val adjustmentId = resolution.adjustment?.let { adjust(tenantId, before, it, resolution.reason, person) }
            incidents.resolve(tenantId, id, resolution.decision, resolution.reason, adjustmentId, resolver)
            audit.record(
                tenantId, person, "incident.resolved", "incident", id,
                buildMap {
                    put("decision", resolution.decision)
                    resolution.adjustment?.let { put("adjustment", it.kind) }
                },
            )
        }
        return incidents.find(tenantId, id)!!
    }

    private data class AdjustmentInput(val kind: String, val eventId: UUID?, val eventType: String?, val occurredAt: OffsetDateTime?)

    private data class ResolutionInput(val decision: String, val reason: String, val adjustment: AdjustmentInput?)

    @Suppress("UNCHECKED_CAST")
    private fun resolution(checks: Checks, body: Map<String, Any?>): ResolutionInput? {
        if ("resolution" !in body) return null
        val raw = body["resolution"] as? Map<String, Any?>
        if (raw == null) {
            checks.fail("resolution", "invalid_value", "Debe ser un objeto con decisión y motivo.")
            return null
        }
        (raw.keys - setOf("decision", "reason", "adjustment")).forEach { checks.fail("resolution.$it", "unknown_field", "Campo no admitido.") }
        val decision = checks.oneOf("resolution.decision", raw["decision"] as? String, DECISIONS, required = true)
        val reason = checks.text("resolution.reason", raw["reason"] as? String, MAX_REASON, required = true)
        if (reason != null && reason.length < MIN_REASON) checks.fail("resolution.reason", "too_short", "Lleva al menos $MIN_REASON caracteres.")
        val adjustment = adjustment(checks, raw, decision)
        if (checks.failed || decision == null || reason == null) return null
        return ResolutionInput(decision, reason, adjustment)
    }

    @Suppress("UNCHECKED_CAST")
    private fun adjustment(checks: Checks, resolution: Map<String, Any?>, decision: String?): AdjustmentInput? {
        val raw = resolution["adjustment"]
        if (decision != "adjusted") {
            if (raw != null) checks.fail("resolution.adjustment", "not_allowed", "Sólo va cuando la decisión es ajustar.")
            return null
        }
        val map = raw as? Map<String, Any?>
        if (map == null) {
            checks.fail("resolution.adjustment", "required", "Ajustar exige decir qué se ajusta.")
            return null
        }
        val at = "resolution.adjustment"
        (map.keys - setOf("kind", "eventId", "eventType", "occurredAt")).forEach { checks.fail("$at.$it", "unknown_field", "Campo no admitido.") }
        val kind = checks.oneOf("$at.kind", map["kind"] as? String, KINDS, required = true) ?: return null
        val needsEvent = kind != "add_event"
        val needsType = kind != "exclude_event"
        val eventId = checks.uuid("$at.eventId", map["eventId"] as? String, required = needsEvent)
        val eventType = checks.oneOf("$at.eventType", map["eventType"] as? String, Envelopes.TYPES, required = needsType)
        val occurredRaw = map["occurredAt"] as? String
        val occurredAt = try {
            occurredRaw?.let(OffsetDateTime::parse)
        } catch (e: DateTimeParseException) {
            checks.fail("$at.occurredAt", "invalid_date_time", "Debe ser un instante RFC 3339.")
            null
        }
        // Cada clase de ajuste trae lo que usa y nada más.
        if (!needsEvent && map["eventId"] != null) checks.fail("$at.eventId", "not_allowed", "No va al agregar un marcaje.")
        if (!needsType && map["eventType"] != null) checks.fail("$at.eventType", "not_allowed", "No va al excluir un marcaje.")
        if (kind == "add_event" && occurredRaw == null) checks.fail("$at.occurredAt", "required", "Es obligatorio al agregar un marcaje.")
        if (kind != "add_event" && map["occurredAt"] != null) checks.fail("$at.occurredAt", "not_allowed", "Sólo va al agregar un marcaje.")
        return AdjustmentInput(kind, eventId, eventType, occurredAt)
    }

    /** Guarda la intención de corrección. El marcaje original queda como está. */
    private fun adjust(tenantId: UUID, incident: IncidentRow, input: AdjustmentInput, reason: String, person: CurrentPerson): UUID {
        val affectedAt = if (input.eventId != null) {
            incidents.eventTime(tenantId, incident.employeeId, input.eventId)
                ?: throw Problems.validation("resolution.adjustment.eventId", "event_not_found", "El marcaje no existe para esa persona.")
        } else {
            input.occurredAt!!
        }
        // Una semana cerrada no cambia: primero se reabre, con su motivo.
        val tenant = tenants.find(tenantId)!!
        val weekStart = WeekCalculator.weekStart(affectedAt.atZoneSameInstant(ZoneId.of(tenant.timeZone)).toLocalDate(), tenant.weekStartsOn)
        if (incidents.weekIsClosed(tenantId, incident.employeeId, weekStart)) {
            throw Problems.conflict("week_closed", "La semana de ese marcaje ya está cerrada; hay que reabrirla antes de ajustar.")
        }
        val id = UUID.randomUUID()
        incidents.insertAdjustment(
            tenantId, id, incident.employeeId, input.kind, input.eventId, if (input.kind == "exclude_event") null else input.eventType,
            if (input.kind == "add_event") input.occurredAt else null, reason, person.actorId,
        )
        return id
    }

    private fun weekRange(tenantId: UUID, date: LocalDate): Pair<OffsetDateTime, OffsetDateTime> {
        val tenant = tenants.find(tenantId)!!
        val start = WeekCalculator.weekStart(date, tenant.weekStartsOn)
        val zone = ZoneId.of(tenant.timeZone)
        return start.atStartOfDay(zone).toOffsetDateTime() to start.plusDays(7).atStartOfDay(zone).toOffsetDateTime()
    }

    private companion object {
        val STATUSES = setOf("open", "resolved")
        val TYPES = setOf("duplicate", "missing_pair", "outside_window", "location_inconclusive", "clock_anomaly", "foreign_site", "late_sync")
        val DECISIONS = setOf("justified", "confirmed", "adjusted")
        val KINDS = setOf("add_event", "exclude_event", "retype_event")
        const val MIN_REASON = 10
        const val MAX_REASON = 500
    }
}

@RestController
@RequestMapping("/api/v1/incidents")
class IncidentController(private val service: IncidentService) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam status: String?,
        @RequestParam type: String?,
        @RequestParam siteId: String?,
        @RequestParam week: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<IncidentView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, status, type, siteId, week, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.openedAt, it.id) }) { IncidentView.of(it) }
    }

    @GetMapping("/{incidentId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable incidentId: UUID): IncidentView =
        IncidentView.of(service.get(person, incidentId))

    @PatchMapping("/{incidentId}")
    fun update(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable incidentId: UUID,
        @RequestBody body: Map<String, Any?>,
    ): IncidentView = IncidentView.of(service.update(person, incidentId, body))
}
