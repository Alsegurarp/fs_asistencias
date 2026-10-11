package mx.fastsolution.zenit.workday

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.capture.IncidentSeverity
import mx.fastsolution.zenit.employee.EmployeeRepository
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.Role
import mx.fastsolution.zenit.site.SiteRepository
import mx.fastsolution.zenit.tenant.TenantRepository
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import java.util.UUID

data class AcknowledgementView(val id: String, val closureId: String, val type: String, val note: String?, val at: String, val evidenceHash: String)

data class ClosureRow(
    val id: UUID,
    val employeeId: UUID,
    val weekStart: LocalDate,
    val version: Int,
    val status: String,
    val ruleSetId: UUID,
    val ruleSetVersion: Int,
    val totals: Totals,
    val hash: String,
    val closedAt: OffsetDateTime,
    val closedBy: UUID,
    val acknowledgement: AcknowledgementView?,
)

data class WeekClosureView(
    val id: String,
    val employeeId: String,
    val weekStart: String,
    val version: Int,
    val status: String,
    val ruleSet: RuleSetRef,
    val totals: Totals,
    val hash: String,
    val closedAt: String,
    val closedBy: String,
    val acknowledgement: AcknowledgementView?,
) {
    companion object {
        fun of(row: ClosureRow) = WeekClosureView(
            row.id.toString(), row.employeeId.toString(), row.weekStart.toString(), row.version, row.status,
            RuleSetRef(row.ruleSetId.toString(), row.ruleSetVersion), row.totals, row.hash, row.closedAt.toInstant().toString(),
            row.closedBy.toString(), row.acknowledgement,
        )
    }
}

data class BlockedClosureView(val employeeId: String, val reason: String, val incidentIds: List<String>)

data class WeekClosureResultView(val weekStart: String, val closed: List<WeekClosureView>, val blocked: List<BlockedClosureView>)

class WeekClosureRequest {
    var weekStart: String? = null
    var siteId: String? = null
    var employeeIds: List<String>? = null
}

class WeekClosureReopenRequest {
    var reason: String? = null
}

class AcknowledgementRequest {
    var type: String? = null
    var note: String? = null
}


@Repository
class ClosureRepository(private val dsl: DSLContext) {
    fun find(tenantId: UUID, id: UUID): ClosureRow? = dsl.fetchOne("$SELECT where c.tenant_id = ? and c.id = ?", tenantId, id)?.let(::row)

    fun latest(tenantId: UUID, employeeId: UUID, weekStart: LocalDate): ClosureRow? =
        dsl.fetchOne(
            "$SELECT where c.tenant_id = ? and c.employee_id = ? and c.week_start = cast(? as date) order by c.version desc limit 1",
            tenantId, employeeId, weekStart.toString(),
        )?.let(::row)

    fun page(tenantId: UUID, weekStart: LocalDate, employeeId: UUID?, after: PageKey?, limit: Int): List<ClosureRow> {
        val sql = StringBuilder("$SELECT where c.tenant_id = ? and c.week_start = cast(? as date)")
        val binds = mutableListOf<Any>(tenantId, weekStart.toString())
        if (employeeId != null) {
            sql.append(" and c.employee_id = ?")
            binds += employeeId
        }
        if (after != null) {
            sql.append(" and (c.closed_at, c.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by c.closed_at, c.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { row(it) }
    }

    fun insert(tenantId: UUID, id: UUID, employeeId: UUID, weekStart: LocalDate, version: Int, rules: RuleSetRow, totals: Totals, snapshot: String, hash: String, closedBy: UUID) {
        dsl.execute(
            "insert into week_closure (tenant_id, id, employee_id, week_start, version, status, rule_set_id, rule_set_version, " +
                "worked_minutes, break_minutes, ordinary_minutes, overtime_minutes, snapshot, hash, closed_by) " +
                "values (?, ?, ?, cast(? as date), ?, 'closed', ?, ?, ?, ?, ?, ?, cast(? as json), ?, ?)",
            tenantId, id, employeeId, weekStart.toString(), version, rules.id, rules.version, totals.workedMinutes, totals.breakMinutes,
            totals.ordinaryMinutes, totals.overtimeMinutes, snapshot, hash, closedBy,
        )
    }

    fun reopen(tenantId: UUID, id: UUID, by: UUID, reason: String) {
        dsl.execute(
            "update week_closure set status = 'reopened', reopened_at = now(), reopened_by = ?, reopen_reason = ? " +
                "where tenant_id = ? and id = ?",
            by, reason, tenantId, id,
        )
    }

    /** Personas que entran a un cierre: las activas y las que marcaron esa semana, de toda la empresa o de una sede. */
    fun candidates(tenantId: UUID, siteId: UUID?, from: OffsetDateTime, until: OffsetDateTime, limit: Int): List<UUID> {
        val sql = StringBuilder(
            "select e.id from employee e where e.tenant_id = ? and (e.status = 'active' or exists (select 1 from attendance_event a " +
                "where a.tenant_id = e.tenant_id and a.employee_id = e.id and a.observed_at >= cast(? as timestamptz) " +
                "and a.observed_at < cast(? as timestamptz)))",
        )
        val binds = mutableListOf<Any>(tenantId, from, until)
        if (siteId != null) {
            sql.append(" and e.site_id = ?")
            binds += siteId
        }
        sql.append(" order by e.created_at, e.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { it.get("id", UUID::class.java) }
    }

    /**
     * Abre una incidencia sobre el marcaje que dejó un tramo sin cerrar.
     * Devuelve nulo si ese inicio no es un marcaje de esa persona: un tramo que
     * abrió un ajuste no tiene marcaje al cual ligarla.
     */
    fun openMissingPair(tenantId: UUID, employeeId: UUID, eventId: UUID): UUID? {
        val id = UUID.randomUUID()
        val inserted = dsl.execute(
            "insert into incident (tenant_id, id, event_id, employee_id, site_id, type, severity, status) " +
                "select tenant_id, ?, id, employee_id, site_id, ?, ?, 'open' from attendance_event " +
                "where tenant_id = ? and employee_id = ? and id = ?",
            id, MISSING_PAIR, IncidentSeverity.of(MISSING_PAIR), tenantId, employeeId, eventId,
        )
        return if (inserted == 1) id else null
    }

    fun insertAcknowledgement(tenantId: UUID, id: UUID, closureId: UUID, employeeId: UUID, type: String, note: String?, at: OffsetDateTime, actorType: String, actorId: String, hash: String) {
        dsl.execute(
            "insert into closure_acknowledgement (tenant_id, id, closure_id, employee_id, type, note, at, actor_type, actor_id, evidence_hash) " +
                "values (?, ?, ?, ?, ?, cast(? as text), cast(? as timestamptz), ?, ?, ?)",
            tenantId, id, closureId, employeeId, type, note, at, actorType, actorId, hash,
        )
    }

    fun lock(tenantId: UUID, id: UUID): Boolean =
        dsl.fetchOne("select id from week_closure where tenant_id = ? and id = ? for update", tenantId, id) != null

    private fun row(r: Record) = ClosureRow(
        id = r.get("id", UUID::class.java),
        employeeId = r.get("employee_id", UUID::class.java),
        weekStart = LocalDate.parse(r.get("week_start", String::class.java)),
        version = r.get("version", Number::class.java).toInt(),
        status = r.get("status", String::class.java),
        ruleSetId = r.get("rule_set_id", UUID::class.java),
        ruleSetVersion = r.get("rule_set_version", Number::class.java).toInt(),
        totals = Totals(
            r.get("worked_minutes", Number::class.java).toInt(), r.get("break_minutes", Number::class.java).toInt(),
            r.get("ordinary_minutes", Number::class.java).toInt(), r.get("overtime_minutes", Number::class.java).toInt(),
        ),
        hash = r.get("hash", String::class.java).trim(),
        closedAt = r.get("closed_at", OffsetDateTime::class.java),
        closedBy = r.get("closed_by", UUID::class.java),
        acknowledgement = r.get("ack_id", UUID::class.java)?.let {
            AcknowledgementView(
                it.toString(), r.get("id", UUID::class.java).toString(), r.get("ack_type", String::class.java),
                r.get("ack_note", String::class.java), r.get("ack_at", OffsetDateTime::class.java).toInstant().toString(),
                r.get("ack_hash", String::class.java).trim(),
            )
        },
    )

    private companion object {
        const val MISSING_PAIR = "missing_pair"
        const val SELECT =
            "select c.id, c.employee_id, cast(c.week_start as text) as week_start, c.version, c.status, c.rule_set_id, " +
                "c.rule_set_version, c.worked_minutes, c.break_minutes, c.ordinary_minutes, c.overtime_minutes, " +
                "cast(c.hash as text) as hash, c.closed_at, c.closed_by, k.id as ack_id, k.type as ack_type, k.note as ack_note, " +
                "k.at as ack_at, cast(k.evidence_hash as text) as ack_hash from week_closure c " +
                "left join closure_acknowledgement k on k.tenant_id = c.tenant_id and k.closure_id = c.id"
    }
}

/**
 * Cierre semanal: congela el cálculo de cada persona con las reglas vigentes.
 * Reabrir conserva la versión cerrada; volver a cerrar crea una nueva.
 */
@Service
class ClosureService(
    private val closures: ClosureRepository,
    private val weeks: WeekService,
    private val employees: EmployeeRepository,
    private val sites: SiteRepository,
    private val tenants: TenantRepository,
    private val audit: AuditLog,
) {
    @Transactional
    fun close(person: CurrentPerson, request: WeekClosureRequest): WeekClosureResultView {
        val tenantId = person.requireTenant()
        val closedBy = person.userId ?: throw Problems.forbidden()
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        val checks = Checks()
        val date = checks.date("weekStart", request.weekStart, required = true)
        val siteId = checks.uuid("siteId", request.siteId, required = false)
        val listed = request.employeeIds?.mapIndexedNotNull { index, raw -> checks.uuid("employeeIds[$index]", raw, required = true) }
        if (listed != null && listed.size > MAX_EMPLOYEES) checks.fail("employeeIds", "too_many", "Admite hasta $MAX_EMPLOYEES personas.")
        if (siteId != null && sites.find(tenantId, siteId) == null) checks.fail("siteId", "site_not_found", "La sede no existe.")
        checks.done()

        val zone = ZoneId.of(tenant.timeZone)
        val weekStart = WeekCalculator.weekStart(date!!, tenant.weekStartsOn)
        val from = weekStart.atStartOfDay(zone).toOffsetDateTime()
        val until = weekStart.plusDays(7).atStartOfDay(zone).toOffsetDateTime()
        // Una semana que no ha terminado todavía puede recibir marcajes.
        if (until > OffsetDateTime.now()) throw Problems.validation("weekStart", "week_not_finished", "La semana todavía no termina.")

        val selected = listed ?: closures.candidates(tenantId, siteId, from, until, MAX_EMPLOYEES + 1)
        if (selected.size > MAX_EMPLOYEES) {
            throw Problems.validation("siteId", "too_many", "Son más de $MAX_EMPLOYEES personas: hay que cerrar por sede o por lista.")
        }
        val closed = mutableListOf<WeekClosureView>()
        val blocked = mutableListOf<BlockedClosureView>()
        for (employeeId in selected.distinct()) {
            // Los cierres de una persona pasan de uno en uno.
            if (!employees.lock(tenantId, employeeId)) {
                throw Problems.validation("employeeIds", "employee_not_found", "Una de las personas no existe.")
            }
            val current = closures.latest(tenantId, employeeId, weekStart)
            if (current != null && current.status == "closed") {
                closed += WeekClosureView.of(current)
                continue
            }
            val computed = weeks.compute(tenant, employeeId, weekStart)
            if (computed.openIncidentIds.isNotEmpty()) {
                blocked += BlockedClosureView(employeeId.toString(), "open_incidents", computed.openIncidentIds.map { it.toString() })
                continue
            }
            if (computed.hasOpenSegment) {
                // Un tramo abierto sin incidencia no tendría con qué corregirse: se abre una sobre
                // el marcaje que lo inició, para que alguien agregue la salida o lo excluya.
                val opened = computed.core.segments.filter { it.endAt == null }
                    .mapNotNull { closures.openMissingPair(tenantId, employeeId, UUID.fromString(it.startEventId)) }
                opened.forEach { audit.record(tenantId, person, "incident.opened", "incident", it, mapOf("type" to "missing_pair")) }
                blocked += BlockedClosureView(employeeId.toString(), "open_segment", opened.map { it.toString() })
                continue
            }
            val snapshot = weeks.snapshot(computed.core)
            val id = UUID.randomUUID()
            val version = (current?.version ?: 0) + 1
            closures.insert(tenantId, id, employeeId, weekStart, version, computed.rules, computed.core.totals, snapshot, sha256(snapshot), closedBy)
            audit.record(tenantId, person, "week.closed", "week_closure", id, mapOf("weekStart" to weekStart.toString(), "version" to version.toString()))
            closed += WeekClosureView.of(closures.find(tenantId, id)!!)
        }
        return WeekClosureResultView(weekStart.toString(), closed, blocked)
    }

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, week: String?, employeeId: String?, after: PageKey?, limit: Int): List<ClosureRow> {
        val tenantId = person.requireTenant()
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        val checks = Checks()
        val date = checks.date("week", week, required = true)
        val employee = checks.uuid("employeeId", employeeId, required = false)
        checks.done()
        return closures.page(tenantId, WeekCalculator.weekStart(date!!, tenant.weekStartsOn), employee, after, limit + 1)
    }

    /** Quien sólo es trabajador ve su propio cierre; los de otras personas no existen para él. */
    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): ClosureRow {
        val row = closures.find(person.requireTenant(), id) ?: throw Problems.notFound()
        val staff = person.roles.any { it in STAFF }
        if (!staff && row.employeeId != person.employeeId) throw Problems.notFound()
        return row
    }

    @Transactional
    fun reopen(person: CurrentPerson, id: UUID, request: WeekClosureReopenRequest): ClosureRow {
        val tenantId = person.requireTenant()
        val by = person.userId ?: throw Problems.forbidden()
        val checks = Checks()
        val reason = checks.text("reason", request.reason, MAX_TEXT, required = true)
        if (reason != null && reason.length < MIN_REASON) checks.fail("reason", "too_short", "Lleva al menos $MIN_REASON caracteres.")
        checks.done()

        if (!closures.lock(tenantId, id)) throw Problems.notFound()
        val row = closures.find(tenantId, id)!!
        if (row.status != "closed") throw Problems.conflict("closure_not_closed", "Ese cierre ya está reabierto.")
        closures.reopen(tenantId, id, by, reason!!)
        audit.record(tenantId, person, "week.reopened", "week_closure", id, mapOf("reason" to reason, "version" to row.version.toString()))
        return closures.find(tenantId, id)!!
    }

    /** El trabajador dice si está conforme con su cierre o lo objeta. Una vez por cierre. */
    @Transactional
    fun acknowledge(authentication: Authentication, id: UUID, request: AcknowledgementRequest): AcknowledgementView {
        val (tenantId, employeeId) = Worker.of(authentication)
        val (actorType, actorId) = Worker.actor(authentication)
        val checks = Checks()
        val type = checks.oneOf("type", request.type, setOf("agreed", "objected"), required = true)
        val note = checks.text("note", request.note, MAX_TEXT, required = false)
        checks.done()

        if (!closures.lock(tenantId, id)) throw Problems.notFound()
        val row = closures.find(tenantId, id)!!
        // El cierre de otra persona no existe para quien llama.
        if (row.employeeId != employeeId) throw Problems.notFound()
        if (row.status != "closed") throw Problems.conflict("closure_not_closed", "Ese cierre está reabierto: no hay nada vigente que acusar.")
        if (row.acknowledgement != null) throw Problems.conflict("already_acknowledged", "Ese cierre ya tiene acuse.")

        // La hora se fija aquí, con la precisión que conserva la base, porque entra en la huella.
        val at = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS)
        val hash = sha256("${row.hash}|$type|${note ?: ""}|${at.toInstant()}|$actorType:$actorId")
        closures.insertAcknowledgement(tenantId, UUID.randomUUID(), id, employeeId, type!!, note, at, actorType, actorId, hash)
        audit.record(tenantId, actorType, actorId, "week.acknowledged", "week_closure", id, mapOf("type" to type))
        return closures.find(tenantId, id)!!.acknowledgement!!
    }

    private fun sha256(text: String): String =
        MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }

    private companion object {
        const val MAX_EMPLOYEES = 500
        const val MIN_REASON = 10
        const val MAX_TEXT = 500
        val STAFF = setOf(Role.ADMIN_EMPRESA, Role.RH, Role.SUPERVISOR, Role.AUDITOR)
    }
}

@RestController
@RequestMapping("/api/v1/week-closures")
class ClosureController(private val service: ClosureService) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam week: String?,
        @RequestParam employeeId: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<WeekClosureView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, week, employeeId, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.closedAt, it.id) }) { WeekClosureView.of(it) }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun close(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: WeekClosureRequest): WeekClosureResultView =
        service.close(person, request)

    @GetMapping("/{closureId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable closureId: UUID): WeekClosureView =
        WeekClosureView.of(service.get(person, closureId))

    @PostMapping("/{closureId}/reopen")
    fun reopen(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable closureId: UUID,
        @RequestBody request: WeekClosureReopenRequest,
    ): WeekClosureView = WeekClosureView.of(service.reopen(person, closureId, request))

    @PostMapping("/{closureId}/acknowledgements")
    @ResponseStatus(HttpStatus.CREATED)
    fun acknowledge(
        authentication: Authentication,
        @PathVariable closureId: UUID,
        @RequestBody request: AcknowledgementRequest,
    ): AcknowledgementView = service.acknowledge(authentication, closureId, request)
}
