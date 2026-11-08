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
import mx.fastsolution.zenit.identity.SiteScope
import mx.fastsolution.zenit.tenant.TenantRepository
import mx.fastsolution.zenit.user.UserRepository
import mx.fastsolution.zenit.user.UserRow
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
    val employeeName: String,
    val employeeExternalId: String,
    val assigneeName: String?,
    val assignedAt: OffsetDateTime?,
    val assignedBy: UUID?,
    val assignedByName: String?,
    val resolvedByName: String?,
    val blocksClosure: Boolean,
)

/** Sólo lleva lo que su clase de ajuste usa. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class AdjustmentView(val kind: String, val eventId: String?, val eventType: String?, val occurredAt: String?)

data class ResolutionView(
    val decision: String,
    val reason: String,
    val adjustment: AdjustmentView?,
    val resolvedBy: String,
    val resolvedByName: String?,
    val resolvedAt: String,
)

data class IncidentView(
    val id: String,
    val type: String,
    val severity: String,
    val status: String,
    val employeeId: String?,
    val employeeName: String,
    val employeeExternalId: String,
    val siteId: String?,
    val eventIds: List<String>,
    val occurredAt: String,
    val openedAt: String,
    val assigneeUserId: String?,
    val assigneeName: String?,
    val assignedAt: String?,
    val assignedBy: String?,
    val assignedByName: String?,
    val blocksClosure: Boolean,
    val resolution: ResolutionView?,
) {
    companion object {
        fun of(row: IncidentRow) = IncidentView(
            id = row.id.toString(),
            type = row.type,
            severity = row.severity,
            status = row.status,
            employeeId = row.employeeId.toString(),
            employeeName = row.employeeName,
            employeeExternalId = row.employeeExternalId,
            siteId = row.siteId?.toString(),
            eventIds = listOf(row.eventId.toString()),
            occurredAt = row.eventAt.toInstant().toString(),
            openedAt = row.openedAt.toInstant().toString(),
            assigneeUserId = row.assigneeUserId?.toString(),
            assigneeName = row.assigneeName,
            assignedAt = row.assignedAt?.toInstant()?.toString(),
            assignedBy = row.assignedBy?.toString(),
            assignedByName = row.assignedByName,
            blocksClosure = row.blocksClosure,
            resolution = if (row.decision != null && row.reason != null && row.resolvedBy != null && row.resolvedAt != null) {
                ResolutionView(
                    row.decision, row.reason, row.adjustment, row.resolvedBy.toString(), row.resolvedByName,
                    row.resolvedAt.toInstant().toString(),
                )
            } else {
                null
            },
        )
    }
}

/** Qué incidencias pide la lista. `assignee` es `me`, `unassigned` o `assigned`; `me` usa `userId`. */
data class IncidentFilter(
    val status: String? = null,
    val type: String? = null,
    val siteId: UUID? = null,
    val week: Pair<OffsetDateTime, OffsetDateTime>? = null,
    val severity: String? = null,
    val assignee: String? = null,
    val userId: UUID? = null,
    val blocksClosure: Boolean? = null,
)

data class OpenIncidentCounts(val total: Int, val unassigned: Int, val mine: Int, val high: Int, val medium: Int, val low: Int, val blockingClosure: Int)

data class ResolvedIncidentCounts(val total: Int, val thisWeek: Int)

data class IncidentSummaryView(val weekStart: String, val open: OpenIncidentCounts, val resolved: ResolvedIncidentCounts)

data class IncidentAssigneeView(val id: String, val displayName: String?, val roles: List<String>)

@Repository
class IncidentRepository(private val dsl: DSLContext) {
    fun find(tenantId: UUID, id: UUID): IncidentRow? = dsl.fetchOne("$SELECT where i.tenant_id = ? and i.id = ?${SiteScope.clause("i.site_id")}", tenantId, id)?.let(::row)

    /** Pone en fila los cambios sobre una misma incidencia. */
    fun lock(tenantId: UUID, id: UUID): Boolean =
        dsl.fetchOne("select id from incident where tenant_id = ? and id = ? for update", tenantId, id) != null

    /**
     * `opened`: de la más antigua a la más reciente. `severity`: la más grave
     * primero y, dentro de cada severidad, la más antigua. `resolved`: la
     * resuelta más recientemente primero.
     */
    fun page(tenantId: UUID, filter: IncidentFilter, sort: String, after: PageKey?, limit: Int): List<IncidentRow> {
        val sql = StringBuilder("$SELECT where i.tenant_id = ?${SiteScope.clause("i.site_id")}")
        val binds = mutableListOf<Any?>(tenantId)
        where(filter, sql, binds)
        when (sort) {
            "severity" -> {
                if (after != null) {
                    sql.append(" and ($RANK < ? or ($RANK = ? and (i.created_at, i.id) > (cast(? as timestamptz), cast(? as uuid))))")
                    binds.addAll(listOf(after.rank, after.rank, after.at, after.id))
                }
                sql.append(" order by $RANK desc, i.created_at, i.id limit ?")
            }
            "resolved" -> {
                if (after != null) {
                    sql.append(" and (i.resolved_at, i.id) < (cast(? as timestamptz), cast(? as uuid))")
                    binds.addAll(listOf(after.at, after.id))
                }
                sql.append(" order by i.resolved_at desc, i.id desc limit ?")
            }
            else -> {
                if (after != null) {
                    sql.append(" and (i.created_at, i.id) > (cast(? as timestamptz), cast(? as uuid))")
                    binds.addAll(listOf(after.at, after.id))
                }
                sql.append(" order by i.created_at, i.id limit ?")
            }
        }
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { row(it) }
    }

    /**
     * Conteos con los mismos filtros y el mismo alcance que la lista. Las
     * abiertas son pocas y llevan el cálculo de bloqueo; las resueltas crecen
     * sin tope y se cuentan sólo sobre su índice, sin leer el marcaje salvo
     * que se filtre por semana.
     */
    fun summary(tenantId: UUID, filter: IncidentFilter, weekStartsAt: OffsetDateTime): Pair<OpenIncidentCounts, ResolvedIncidentCounts> {
        val scope = SiteScope.clause("i.site_id")
        val open = StringBuilder(
            "select count(*) as total, count(*) filter (where i.assignee_user_id is null) as unassigned, " +
                "count(*) filter (where i.assignee_user_id = cast(? as uuid)) as mine, " +
                "count(*) filter (where i.severity = 'high') as high, count(*) filter (where i.severity = 'medium') as medium, " +
                "count(*) filter (where i.severity = 'low') as low, count(*) filter (where $BLOCKS) as blocking " +
                "$FROM where i.tenant_id = ? and i.status = 'open'$scope",
        )
        val openBinds = mutableListOf<Any?>(filter.userId, tenantId)
        where(filter, open, openBinds)
        val resolved = StringBuilder(
            "select count(*) as total, count(*) filter (where i.resolved_at >= cast(? as timestamptz)) as this_week " +
                (if (filter.week != null) FROM else "from incident i") + " where i.tenant_id = ? and i.status = 'resolved'$scope",
        )
        val resolvedBinds = mutableListOf<Any?>(weekStartsAt, tenantId)
        where(filter, resolved, resolvedBinds)
        val o = dsl.fetchOne(open.toString(), *openBinds.toTypedArray())!!
        val r = dsl.fetchOne(resolved.toString(), *resolvedBinds.toTypedArray())!!
        fun n(record: Record, column: String) = record.get(column, Number::class.java).toInt()
        return OpenIncidentCounts(
            n(o, "total"), n(o, "unassigned"), n(o, "mine"), n(o, "high"), n(o, "medium"), n(o, "low"), n(o, "blocking"),
        ) to ResolvedIncidentCounts(n(r, "total"), n(r, "this_week"))
    }

    /** Personas distintas con al menos una incidencia que bloquea su cierre, con el alcance de la lista. */
    fun blockedPeople(tenantId: UUID, filter: IncidentFilter): Int {
        val sql = StringBuilder("select count(distinct i.employee_id) as people $FROM where i.tenant_id = ?${SiteScope.clause("i.site_id")}")
        val binds = mutableListOf<Any?>(tenantId)
        where(filter.copy(blocksClosure = true), sql, binds)
        return dsl.fetchOne(sql.toString(), *binds.toTypedArray())!!.get("people", Number::class.java).toInt()
    }

    /** Asignar guarda quién y cuándo; quitar la asignación lo borra. */
    fun assign(tenantId: UUID, id: UUID, assignee: UUID?, by: UUID) {
        dsl.execute(
            "update incident set assignee_user_id = cast(? as uuid), assigned_by = cast(? as uuid), " +
                "assigned_at = case when ? then now() end where tenant_id = ? and id = ?",
            assignee, if (assignee != null) by else null, assignee != null, tenantId, id,
        )
    }

    private fun where(filter: IncidentFilter, sql: StringBuilder, binds: MutableList<Any?>) {
        fun equal(column: String, value: Any?) {
            if (value != null) {
                sql.append(" and $column = ?")
                binds += value
            }
        }
        equal("i.status", filter.status)
        equal("i.type", filter.type)
        equal("i.site_id", filter.siteId)
        equal("i.severity", filter.severity)
        if (filter.week != null) {
            sql.append(" and e.observed_at >= cast(? as timestamptz) and e.observed_at < cast(? as timestamptz)")
            binds += filter.week.first
            binds += filter.week.second
        }
        when (filter.assignee) {
            "unassigned" -> sql.append(" and i.assignee_user_id is null")
            "assigned" -> sql.append(" and i.assignee_user_id is not null")
            "me" -> if (filter.userId == null) {
                sql.append(" and false")
            } else {
                sql.append(" and i.assignee_user_id = ?")
                binds += filter.userId
            }
        }
        when (filter.blocksClosure) {
            // El estado va aparte para que la consulta use el índice de las abiertas.
            true -> sql.append(" and i.status = 'open' and ($BLOCKS)")
            false -> sql.append(" and not ($BLOCKS)")
            null -> Unit
        }
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
        employeeName = r.get("employee_name", String::class.java),
        employeeExternalId = r.get("employee_external_id", String::class.java),
        assigneeName = r.get("assignee_name", String::class.java),
        assignedAt = r.get("assigned_at", OffsetDateTime::class.java),
        assignedBy = r.get("assigned_by", UUID::class.java),
        assignedByName = r.get("assigned_by_name", String::class.java),
        resolvedByName = r.get("resolved_by_name", String::class.java),
        blocksClosure = r.get("blocks_closure", Boolean::class.java),
    )

    companion object {
        /** Severidad como número, para ordenar de la más grave a la más leve. */
        fun rank(severity: String): Int = when (severity) {
            "high" -> 3
            "medium" -> 2
            else -> 1
        }

        private const val RANK = "(case i.severity when 'high' then 3 when 'medium' then 2 else 1 end)"

        /** Semana de la empresa en la que cayó el marcaje. */
        private const val EVENT_WEEK = "week_start_of(e.observed_at, t.time_zone, t.week_starts_on)"

        /**
         * Bloquea un cierre: sigue abierta, su semana ya terminó (sólo entonces
         * se puede cerrar) y esa persona no tiene esa semana cerrada. Una
         * abierta en una semana ya cerrada no bloquea nada: pide reabrirla.
         */
        private const val BLOCKS =
            "i.status = 'open' and $EVENT_WEEK < week_start_of(now(), t.time_zone, t.week_starts_on) " +
                "and not exists (select 1 from week_closure blocking where blocking.tenant_id = i.tenant_id " +
                "and blocking.employee_id = i.employee_id and blocking.week_start = $EVENT_WEEK and blocking.status = 'closed')"

        private const val FROM =
            "from incident i join tenant t on t.id = i.tenant_id " +
                "join attendance_event e on e.tenant_id = i.tenant_id and e.id = i.event_id"

        private const val SELECT =
            "select i.id, i.type, i.severity, i.status, i.employee_id, i.site_id, i.event_id, e.observed_at, i.created_at, " +
                "i.assignee_user_id, i.assigned_at, i.assigned_by, i.resolution_decision, i.resolution_reason, i.resolved_by, " +
                "i.resolved_at, a.kind as adjustment_kind, a.event_id as adjustment_event_id, " +
                "a.event_type as adjustment_event_type, a.occurred_at as adjustment_occurred_at, " +
                "emp.display_name as employee_name, emp.external_id as employee_external_id, " +
                "nullif(assignee.display_name, '') as assignee_name, nullif(assigner.display_name, '') as assigned_by_name, " +
                "nullif(resolver.display_name, '') as resolved_by_name, ($BLOCKS) as blocks_closure $FROM " +
                "join employee emp on emp.tenant_id = i.tenant_id and emp.id = i.employee_id " +
                "left join adjustment a on a.tenant_id = i.tenant_id and a.id = i.adjustment_id " +
                "left join tenant_user assignee on assignee.tenant_id = i.tenant_id and assignee.id = i.assignee_user_id " +
                "left join tenant_user assigner on assigner.tenant_id = i.tenant_id and assigner.id = i.assigned_by " +
                "left join tenant_user resolver on resolver.tenant_id = i.tenant_id and resolver.id = i.resolved_by"
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
    /** Lo que llega en la consulta de la lista, tal como viene. */
    data class ListQuery(
        val status: String? = null,
        val type: String? = null,
        val siteId: String? = null,
        val week: String? = null,
        val severity: String? = null,
        val assignee: String? = null,
        val blocksClosure: String? = null,
        val sort: String? = null,
    )

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, query: ListQuery, after: PageKey?, limit: Int): List<IncidentRow> {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val sort = checks.oneOf("sort", query.sort, SORTS, required = false) ?: "opened"
        val filter = filter(person, tenantId, checks, query)
        if (sort == "resolved" && filter.status != "resolved") {
            checks.fail("sort", "requires_resolved_status", "Ordenar por resolución sólo aplica a las resueltas.")
        }
        checks.done()
        // El cursor trae la severidad sólo cuando la lista se ordena por ella.
        if (after != null && (sort == "severity") != (after.rank != null)) throw Paging.invalidCursor()
        return incidents.page(tenantId, filter, sort, after, limit + 1)
    }

    /** Conteos de la pantalla de incidencias, con el mismo alcance y los mismos filtros de contexto que la lista. */
    @Transactional(readOnly = true)
    fun summary(person: CurrentPerson, query: ListQuery): IncidentSummaryView {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val filter = filter(person, tenantId, checks, ListQuery(type = query.type, siteId = query.siteId, week = query.week))
        checks.done()
        val tenant = tenants.find(tenantId)!!
        val zone = ZoneId.of(tenant.timeZone)
        val weekStart = WeekCalculator.weekStart(LocalDate.now(zone), tenant.weekStartsOn)
        val (open, resolved) = incidents.summary(tenantId, filter, weekStart.atStartOfDay(zone).toOffsetDateTime())
        return IncidentSummaryView(weekStart.toString(), open, resolved)
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): IncidentRow = incidents.find(person.requireTenant(), id) ?: throw Problems.notFound()

    /** A quién se puede asignar: quienes pueden resolverla, y nadie más. */
    @Transactional(readOnly = true)
    fun assignees(person: CurrentPerson, id: UUID, after: PageKey?, limit: Int): List<UserRow> {
        val tenantId = person.requireTenant()
        val incident = incidents.find(tenantId, id) ?: throw Problems.notFound()
        return users.resolvers(tenantId, incident.siteId, after, limit + 1)
    }

    private fun filter(person: CurrentPerson, tenantId: UUID, checks: Checks, query: ListQuery): IncidentFilter {
        val status = checks.oneOf("status", query.status, STATUSES, required = false)
        val type = checks.oneOf("type", query.type, TYPES, required = false)
        val site = checks.uuid("siteId", query.siteId, required = false)
        val date = checks.date("week", query.week, required = false)
        val severity = checks.oneOf("severity", query.severity, SEVERITIES, required = false)
        val assignee = checks.oneOf("assignee", query.assignee, ASSIGNEES, required = false)
        val blocks = checks.oneOf("blocksClosure", query.blocksClosure, setOf("true", "false"), required = false)
        return IncidentFilter(
            status, type, site, date?.let { weekRange(tenantId, it) }, severity, assignee, person.userId, blocks?.toBooleanStrictOrNull(),
        )
    }

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
        val before = incidents.find(tenantId, id) ?: throw Problems.notFound()
        if (before.status != "open") throw Problems.conflict("incident_already_resolved", "La incidencia ya está resuelta.")

        if ("assigneeUserId" in body) {
            if (assignee != null && users.find(tenantId, assignee)?.takeIf { it.status != "disabled" } == null) {
                throw Problems.validation("assigneeUserId", "user_not_found", "Esa persona no tiene acceso vigente a la empresa.")
            }
            // Asignarla a quien no puede resolverla la dejaría detenida.
            if (assignee != null && !users.canResolve(tenantId, assignee, before.siteId)) {
                throw Problems.validation("assigneeUserId", "assignee_cannot_resolve", "Esa persona no puede resolver incidencias de esta sede.")
            }
            incidents.assign(tenantId, id, assignee, resolver)
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
        val SORTS = setOf("opened", "severity", "resolved")
        val SEVERITIES = setOf("low", "medium", "high")
        val ASSIGNEES = setOf("me", "unassigned", "assigned")
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
        @RequestParam severity: String?,
        @RequestParam assignee: String?,
        @RequestParam blocksClosure: String?,
        @RequestParam sort: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<IncidentView> {
        val size = Paging.limit(limit)
        val query = IncidentService.ListQuery(status, type, siteId, week, severity, assignee, blocksClosure, sort)
        val rows = service.page(person, query, Paging.decode(cursor), size)
        val key: (IncidentRow) -> PageKey = when (sort) {
            "severity" -> { it -> PageKey(it.openedAt, it.id, IncidentRepository.rank(it.severity)) }
            "resolved" -> { it -> PageKey(it.resolvedAt!!, it.id) }
            else -> { it -> PageKey(it.openedAt, it.id) }
        }
        return Paging.page(rows, size, key) { IncidentView.of(it) }
    }

    @GetMapping("/summary")
    fun summary(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam type: String?,
        @RequestParam siteId: String?,
        @RequestParam week: String?,
    ): IncidentSummaryView = service.summary(person, IncidentService.ListQuery(type = type, siteId = siteId, week = week))

    @GetMapping("/{incidentId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable incidentId: UUID): IncidentView =
        IncidentView.of(service.get(person, incidentId))

    @GetMapping("/{incidentId}/assignees")
    fun assignees(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable incidentId: UUID,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<IncidentAssigneeView> {
        val size = Paging.limit(limit)
        val rows = service.assignees(person, incidentId, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.createdAt, it.id) }) {
            IncidentAssigneeView(it.id.toString(), it.displayName.ifBlank { null }, it.roles.sorted())
        }
    }

    @PatchMapping("/{incidentId}")
    fun update(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable incidentId: UUID,
        @RequestBody body: Map<String, Any?>,
    ): IncidentView = IncidentView.of(service.update(person, incidentId, body))
}
