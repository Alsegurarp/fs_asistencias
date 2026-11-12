package mx.fastsolution.zenit.employee

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.site.SiteRow
import mx.fastsolution.zenit.device.DeviceRepository
import mx.fastsolution.zenit.capture.CaptureMethods
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.api.TextSearch
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.card.CardRepository
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.SiteScope
import mx.fastsolution.zenit.schedule.ScheduleRepository
import mx.fastsolution.zenit.site.SiteRepository
import mx.fastsolution.zenit.tenant.TenantRepository
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID

data class EmployeeRow(
    val id: UUID,
    val externalId: String,
    val displayName: String,
    val status: String,
    val siteId: UUID?,
    val employmentStart: LocalDate,
    val employmentEnd: LocalDate?,
    val source: String,
    val currentScheduleId: UUID?,
    val activeCardId: UUID?,
    val activeCardLabel: String?,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
    /** Cómo marca: con su tarjeta (`card`) o con su teléfono (`phone`). */
    val captureMethod: String = "card",
)

data class ScheduleAssignmentRow(val id: UUID, val employeeId: UUID, val scheduleId: UUID, val validFrom: LocalDate, val validTo: LocalDate?)

class EmployeeCreateRequest {
    var externalId: String? = null
    var displayName: String? = null
    var siteId: String? = null
    var employmentStart: String? = null
    /** Opcional: si no viene, la tarjeta cuando la sede la admite y si no el teléfono. */
    var captureMethod: String? = null
}

class ScheduleAssignmentRequest {
    var scheduleId: String? = null
    var validFrom: String? = null
}

data class EmployeeView(
    val id: String,
    val externalId: String,
    val displayName: String,
    val status: String,
    val siteId: String?,
    val employmentStart: String,
    val employmentEnd: String?,
    val source: String,
    val currentScheduleId: String?,
    val activeCardId: String?,
    val activeCardLabel: String?,
    val createdAt: String,
    val updatedAt: String,
    val captureMethod: String,
) {
    companion object {
        fun of(row: EmployeeRow) = EmployeeView(
            id = row.id.toString(),
            externalId = row.externalId,
            displayName = row.displayName,
            status = row.status,
            siteId = row.siteId?.toString(),
            employmentStart = row.employmentStart.toString(),
            employmentEnd = row.employmentEnd?.toString(),
            source = row.source,
            currentScheduleId = row.currentScheduleId?.toString(),
            activeCardId = row.activeCardId?.toString(),
            activeCardLabel = row.activeCardLabel,
            createdAt = row.createdAt.toInstant().toString(),
            updatedAt = row.updatedAt.toInstant().toString(),
            captureMethod = row.captureMethod,
        )
    }
}

data class ScheduleAssignmentView(val id: String, val employeeId: String, val scheduleId: String, val validFrom: String, val validTo: String?)

data class ScheduleAssignmentList(val items: List<ScheduleAssignmentView>)

/** `text` es el patrón ya escapado de `TextSearch`. */
data class EmployeeFilter(
    val status: String? = null,
    val siteId: UUID? = null,
    val scheduleId: UUID? = null,
    val withoutCard: Boolean? = null,
    val text: String? = null,
)

data class ScheduleCount(val scheduleId: String, val people: Int)

data class EmployeeSummaryView(
    val total: Int,
    val active: Int,
    val inactive: Int,
    val withoutCard: Int,
    val withoutSchedule: Int,
    val bySchedule: List<ScheduleCount>,
)

@Repository
class EmployeeRepository(private val dsl: DSLContext) {
    /** Sin forma de marcar, la tarjeta cuando la sede (y el plan) la admiten; si no, el teléfono. */
    fun insert(
        tenantId: UUID, id: UUID, externalId: String, displayName: String, siteId: UUID?, start: LocalDate, source: String,
        captureMethod: String? = null,
    ) {
        dsl.execute(
            "insert into employee (tenant_id, id, external_id, display_name, status, site_id, employment_start, source, capture_method) " +
                "values (?, ?, ?, ?, 'active', cast(? as uuid), cast(? as date), ?, coalesce(cast(? as text), " +
                "(select case when 'card_terminal' = any(t.capture_methods) and " +
                "(s.capture_methods is null or 'card_terminal' = any(s.capture_methods)) then 'card' else 'phone' end " +
                "from tenant t left join site s on s.tenant_id = t.id and s.id = cast(? as uuid) where t.id = ?)))",
            tenantId, id, externalId, displayName, siteId, start.toString(), source, captureMethod, siteId, tenantId,
        )
    }

    fun setCaptureMethod(tenantId: UUID, id: UUID, method: String) {
        dsl.execute("update employee set capture_method = ?, updated_at = now() where tenant_id = ? and id = ?", method, tenantId, id)
    }

    fun find(tenantId: UUID, id: UUID): EmployeeRow? =
        dsl.fetchOne("$SELECT where e.tenant_id = ? and e.id = ?${SiteScope.clause("e.site_id")}", tenantId, id)?.let(::row)

    fun findByExternalId(tenantId: UUID, externalId: String): EmployeeRow? =
        dsl.fetchOne("$SELECT where e.tenant_id = ? and e.external_id = ?", tenantId, externalId)?.let(::row)

    /** Pone en fila los cambios sobre una misma persona. */
    fun lock(tenantId: UUID, id: UUID): Boolean =
        dsl.fetchOne("select id from employee where tenant_id = ? and id = ? for update", tenantId, id) != null

    fun page(tenantId: UUID, filter: EmployeeFilter, after: PageKey?, limit: Int): List<EmployeeRow> {
        val sql = StringBuilder("$SELECT where e.tenant_id = ?${SiteScope.clause("e.site_id")}")
        val binds = mutableListOf<Any>(tenantId)
        where(filter, sql, binds)
        if (filter.status != null) {
            sql.append(" and e.status = ?")
            binds += filter.status
        }
        if (after != null) {
            sql.append(" and (e.created_at, e.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by e.created_at, e.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { row(it) }
    }

    /**
     * Conteos de la pestaña de personas con el alcance y los filtros de la
     * lista. Los de estado no aplican el filtro de estado, para rotular cada
     * opción; los demás, sí.
     */
    fun summary(tenantId: UUID, filter: EmployeeFilter): EmployeeSummaryView {
        val matching = if (filter.status != null) "e.status = ?" else "true"
        val sql = StringBuilder(
            "select count(*) filter (where $matching) as total, count(*) filter (where e.status = 'active') as active, " +
                "count(*) filter (where e.status = 'inactive') as inactive, " +
                "count(*) filter (where $matching and ca.card_id is null) as without_card, " +
                "count(*) filter (where $matching and cs.schedule_id is null) as without_schedule " +
                "$FROM where e.tenant_id = ?${SiteScope.clause("e.site_id")}",
        )
        val binds = mutableListOf<Any>()
        repeat(3) { filter.status?.let { binds += it } }
        binds += tenantId
        where(filter.copy(scheduleId = null, withoutCard = null), sql, binds)
        val counts = dsl.fetchOne(sql.toString(), *binds.toTypedArray())!!
        fun n(column: String) = counts.get(column, Number::class.java).toInt()

        val grouped = StringBuilder("select cs.schedule_id, count(*) as people $FROM where e.tenant_id = ?${SiteScope.clause("e.site_id")}")
        val groupBinds = mutableListOf<Any>(tenantId)
        where(filter.copy(scheduleId = null, withoutCard = null), grouped, groupBinds)
        if (filter.status != null) {
            grouped.append(" and e.status = ?")
            groupBinds += filter.status
        }
        grouped.append(" and cs.schedule_id is not null group by cs.schedule_id order by count(*) desc, cs.schedule_id")
        val bySchedule = dsl.fetch(grouped.toString(), *groupBinds.toTypedArray()).map {
            ScheduleCount(it.get("schedule_id", UUID::class.java).toString(), it.get("people", Number::class.java).toInt())
        }
        return EmployeeSummaryView(n("total"), n("active"), n("inactive"), n("without_card"), n("without_schedule"), bySchedule)
    }

    /** Filtros comunes a la lista y a sus conteos, salvo el estado. */
    private fun where(filter: EmployeeFilter, sql: StringBuilder, binds: MutableList<Any>) {
        if (filter.siteId != null) {
            sql.append(" and e.site_id = ?")
            binds += filter.siteId
        }
        if (filter.scheduleId != null) {
            sql.append(" and cs.schedule_id = ?")
            binds += filter.scheduleId
        }
        when (filter.withoutCard) {
            true -> sql.append(" and ca.card_id is null")
            false -> sql.append(" and ca.card_id is not null")
            null -> Unit
        }
        if (filter.text != null) {
            sql.append(TextSearch.clause("e.display_name", "e.external_id"))
            binds.addAll(TextSearch.binds(filter.text, 2))
        }
    }

    fun update(tenantId: UUID, id: UUID, displayName: String, siteId: UUID?, status: String, start: LocalDate, end: LocalDate?) {
        dsl.execute(
            "update employee set display_name = ?, site_id = cast(? as uuid), status = ?, employment_start = cast(? as date), " +
                "employment_end = cast(? as date), updated_at = now() where tenant_id = ? and id = ?",
            displayName, siteId, status, start.toString(), end?.toString(), tenantId, id,
        )
    }

    /** Todas las asignaciones de horario de una persona, de la más reciente a la más antigua. */
    fun assignments(tenantId: UUID, employeeId: UUID): List<ScheduleAssignmentRow> =
        dsl.fetch("$ASSIGNMENT where tenant_id = ? and employee_id = ? order by valid_from desc", tenantId, employeeId).map(::assignment)

    fun latestAssignment(tenantId: UUID, employeeId: UUID): ScheduleAssignmentRow? =
        dsl.fetchOne(
            "$ASSIGNMENT where tenant_id = ? and employee_id = ? order by valid_from desc limit 1", tenantId, employeeId,
        )?.let(::assignment)

    fun closeAssignment(tenantId: UUID, id: UUID, validTo: LocalDate) {
        dsl.execute(
            "update schedule_assignment set valid_to = cast(? as date) where tenant_id = ? and id = ?",
            validTo.toString(), tenantId, id,
        )
    }

    fun endAssignments(tenantId: UUID, employeeId: UUID, end: LocalDate) {
        dsl.execute("update schedule_assignment set valid_to = cast(? as date) where tenant_id = ? and employee_id = ? " +
            "and valid_from <= cast(? as date) and (valid_to is null or valid_to > cast(? as date))",
            end.toString(), tenantId, employeeId, end.toString(), end.toString())
    }

    fun insertAssignment(tenantId: UUID, id: UUID, employeeId: UUID, scheduleId: UUID, from: LocalDate, to: LocalDate?): ScheduleAssignmentRow {
        dsl.execute(
            "insert into schedule_assignment (tenant_id, id, employee_id, schedule_id, valid_from, valid_to) " +
                "values (?, ?, ?, ?, cast(? as date), cast(? as date))",
            tenantId, id, employeeId, scheduleId, from.toString(), to?.toString(),
        )
        return ScheduleAssignmentRow(id, employeeId, scheduleId, from, to)
    }

    private fun assignment(r: Record) = ScheduleAssignmentRow(
        id = r.get("id", UUID::class.java),
        employeeId = r.get("employee_id", UUID::class.java),
        scheduleId = r.get("schedule_id", UUID::class.java),
        validFrom = LocalDate.parse(r.get("valid_from", String::class.java)),
        validTo = r.get("valid_to", String::class.java)?.let(LocalDate::parse),
    )

    private fun row(r: Record) = EmployeeRow(
        id = r.get("id", UUID::class.java),
        externalId = r.get("external_id", String::class.java),
        displayName = r.get("display_name", String::class.java),
        status = r.get("status", String::class.java),
        siteId = r.get("site_id", UUID::class.java),
        employmentStart = LocalDate.parse(r.get("employment_start", String::class.java)),
        employmentEnd = r.get("employment_end", String::class.java)?.let(LocalDate::parse),
        source = r.get("source", String::class.java),
        currentScheduleId = r.get("current_schedule_id", UUID::class.java),
        activeCardId = r.get("active_card_id", UUID::class.java),
        activeCardLabel = r.get("active_card_label", String::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        updatedAt = r.get("updated_at", OffsetDateTime::class.java),
        captureMethod = r.get("capture_method", String::class.java),
    )

    private companion object {
        // El horario vigente se calcula con la fecha de hoy en la zona de la empresa. Va en el FROM para
        // que la lista filtre por horario y por tarjeta en el servidor.
        const val FROM =
            "from employee e join tenant t on t.id = e.tenant_id " +
                "left join lateral (select a.schedule_id from schedule_assignment a where a.tenant_id = e.tenant_id " +
                "and a.employee_id = e.id and a.valid_from <= cast(now() at time zone t.time_zone as date) " +
                "and (a.valid_to is null or a.valid_to >= cast(now() at time zone t.time_zone as date)) " +
                "order by a.valid_from desc limit 1) cs on true " +
                "left join card_assignment ca on ca.tenant_id = e.tenant_id and ca.employee_id = e.id and ca.until is null " +
                "left join card cd on cd.tenant_id = ca.tenant_id and cd.id = ca.card_id"
        const val SELECT =
            "select e.id, e.external_id, e.display_name, e.status, e.site_id, " +
                "cast(e.employment_start as text) as employment_start, cast(e.employment_end as text) as employment_end, " +
                "e.source, e.created_at, e.updated_at, e.capture_method, cs.schedule_id as current_schedule_id, ca.card_id as active_card_id, " +
                "cd.label as active_card_label $FROM"
        const val ASSIGNMENT =
            "select id, employee_id, schedule_id, cast(valid_from as text) as valid_from, " +
                "cast(valid_to as text) as valid_to from schedule_assignment"
    }
}

@Service
class EmployeeService(
    private val employees: EmployeeRepository,
    private val sites: SiteRepository,
    private val schedules: ScheduleRepository,
    private val cards: CardRepository,
    private val devices: DeviceRepository,
    private val tenants: TenantRepository,
    private val audit: AuditLog,
) {
    @Transactional
    fun create(person: CurrentPerson, request: EmployeeCreateRequest): EmployeeRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val externalId = checks.text("externalId", request.externalId, MAX_EXTERNAL_ID, required = true)
        val displayName = checks.text("displayName", request.displayName, MAX_NAME, required = true)
        val siteId = checks.uuid("siteId", request.siteId, required = false)
        val start = checks.date("employmentStart", request.employmentStart, required = true)
        val method = checks.oneOf("captureMethod", request.captureMethod, CaptureMethods.PERSON, required = false)
        // Una sede de otra empresa no existe para quien pregunta.
        val site = siteId?.let { sites.find(tenantId, it) }
        if (siteId != null && site == null) checks.fail("siteId", "site_not_found", "La sede no existe.")
        if (method != null && !admits(tenantId, site, method)) {
            checks.fail("captureMethod", "capture_method_not_allowed", notAllowed(method))
        }
        checks.done()

        val id = UUID.randomUUID()
        try {
            employees.insert(tenantId, id, externalId!!, displayName!!, siteId, start!!, "manual", method)
        } catch (e: RuntimeException) {
            throw if (Conflicts.uniqueConstraint(e) == Conflicts.EMPLOYEE_EXTERNAL_ID) Conflicts.externalIdTaken() else e
        }
        audit.record(tenantId, person, "employee.created", "employee", id, mapOf("source" to "manual"))
        return employees.find(tenantId, id)!!
    }

    /** Lo que llega en la consulta de la lista, tal como viene. */
    data class ListQuery(
        val status: String? = null,
        val siteId: String? = null,
        val scheduleId: String? = null,
        val withoutCard: String? = null,
        val q: String? = null,
    )

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, query: ListQuery, after: PageKey?, limit: Int): List<EmployeeRow> =
        employees.page(person.requireTenant(), filter(query), after, limit + 1)

    @Transactional(readOnly = true)
    fun summary(person: CurrentPerson, query: ListQuery): EmployeeSummaryView =
        employees.summary(person.requireTenant(), filter(query))

    private fun filter(query: ListQuery): EmployeeFilter {
        val checks = Checks()
        val status = checks.oneOf("status", query.status, STATUSES, required = false)
        val site = checks.uuid("siteId", query.siteId, required = false)
        val schedule = checks.uuid("scheduleId", query.scheduleId, required = false)
        val withoutCard = checks.oneOf("withoutCard", query.withoutCard, setOf("true", "false"), required = false)
        val text = TextSearch.pattern(checks, query.q)
        checks.done()
        return EmployeeFilter(status, site, schedule, withoutCard?.toBooleanStrictOrNull(), text)
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): EmployeeRow = employees.find(person.requireTenant(), id) ?: throw Problems.notFound()

    /** Los horarios que ha tenido una persona, con el alcance de [get]: quien no la ve recibe 404. */
    @Transactional(readOnly = true)
    fun assignments(person: CurrentPerson, id: UUID): List<ScheduleAssignmentRow> =
        employees.assignments(person.requireTenant(), get(person, id).id)

    /**
     * Cambia datos o registra la baja. El cuerpo llega como mapa porque aquí
     * importa la diferencia entre no mandar un campo y mandarlo nulo: `siteId`
     * nulo quita la sede y `employmentEnd` nulo borra la fecha de baja.
     */
    @Transactional
    fun update(person: CurrentPerson, id: UUID, body: Map<String, Any?>): EmployeeRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        (body.keys - UPDATABLE).forEach { checks.fail(it, "unknown_field", "Ese campo no se puede cambiar.") }
        if (body.isEmpty()) checks.fail("", "empty_update", "Hay que cambiar al menos un campo.")
        body.forEach { (key, value) ->
            if (value != null && value !is String) checks.fail(key, "invalid_value", "Debe ser texto.")
        }
        checks.done()

        // Mismo orden que asignar/revocar tarjeta: ninguna asignación puede adelantarse a la baja.
        tenants.lock(tenantId)
        if (!employees.lock(tenantId, id)) throw Problems.notFound()
        val before = employees.find(tenantId, id)!!

        val displayName = if ("displayName" in body) checks.text("displayName", body["displayName"] as String?, MAX_NAME, required = true) else before.displayName
        val status = if ("status" in body) checks.oneOf("status", body["status"] as String?, STATUSES, required = true) else before.status
        val siteId = if ("siteId" in body) checks.uuid("siteId", body["siteId"] as String?, required = false) else before.siteId
        val end = if ("employmentEnd" in body) checks.date("employmentEnd", body["employmentEnd"] as String?, required = false) else before.employmentEnd
        val method = if ("captureMethod" in body) {
            checks.oneOf("captureMethod", body["captureMethod"] as String?, CaptureMethods.PERSON, required = true)
        } else {
            before.captureMethod
        }
        val site = siteId?.let { sites.find(tenantId, it) }
        if ("siteId" in body && siteId != null && site == null) {
            checks.fail("siteId", "site_not_found", "La sede no existe.")
        } else if (method != null && ("captureMethod" in body || "siteId" in body) && !admits(tenantId, site, method)) {
            // Cambiar de sede no deja a la persona sin poder marcar.
            if ("captureMethod" in body) {
                checks.fail("captureMethod", "capture_method_not_allowed", notAllowed(method))
            } else {
                checks.fail("siteId", "capture_method_not_allowed", "Esa sede no admite la forma con la que marca esta persona.")
            }
        }
        if (end != null && end < before.employmentStart) {
            checks.fail("employmentEnd", "before_start", "No puede ser anterior al inicio de la relación.")
        }
        if (status == "inactive" && end == null) {
            checks.fail("employmentEnd", "required", "La baja requiere su fecha efectiva; no se deduce de la fecha de edición.")
        }
        if (status == "inactive" && end != null &&
            end > LocalDate.now(ZoneId.of(tenants.find(tenantId)!!.timeZone))) {
            checks.fail("employmentEnd", "future_deactivation", "La baja inmediata no admite una fecha futura.")
        }
        checks.done()

        employees.update(tenantId, id, displayName!!, siteId, status!!, before.employmentStart, end)
        if (status == "inactive" && (before.status != "inactive" || end != before.employmentEnd)) {
            val assignment = cards.openAssignmentOfEmployee(tenantId, id)
            if (assignment != null) {
                cards.setStatus(tenantId, assignment.cardId, "revoked")
                cards.closeAssignmentOfCard(tenantId, assignment.cardId)
                audit.record(tenantId, person, "card.revoked", "card", assignment.cardId,
                    mapOf("reason" to "employee_deactivated", "effectiveOn" to end.toString()))
            }
            employees.endAssignments(tenantId, id, end!!)
        }
        if (method != before.captureMethod) changeCaptureMethod(person, tenantId, id, before.captureMethod, method!!)
        val action = when {
            status == before.status -> "employee.updated"
            status == "inactive" -> "employee.deactivated"
            else -> "employee.reactivated"
        }
        audit.record(tenantId, person, action, "employee", id, mapOf("fields" to body.keys.sorted().joinToString(",")))
        return employees.find(tenantId, id)!!
    }

    /** El plan de la empresa y la sede (o, sin sede, todo el plan) admiten esa forma de marcar. */
    private fun admits(tenantId: UUID, site: SiteRow?, method: String): Boolean =
        CaptureMethods.of(method) in CaptureMethods.effective(tenants.find(tenantId)!!.captureMethods, site?.captureMethods)

    private fun notAllowed(method: String) =
        if (method == "phone") "El plan o la sede no admiten marcar con el teléfono." else "El plan o la sede no admiten marcar con tarjeta."

    /**
     * Una persona marca de una sola forma. Al pasar al teléfono se revoca su
     * tarjeta; al pasar a la tarjeta, su teléfono. Todo queda en la bitácora.
     */
    private fun changeCaptureMethod(person: CurrentPerson, tenantId: UUID, id: UUID, from: String, to: String) {
        employees.setCaptureMethod(tenantId, id, to)
        if (to == "phone") {
            cards.openAssignmentOfEmployee(tenantId, id)?.let { assignment ->
                cards.setStatus(tenantId, assignment.cardId, "revoked")
                cards.closeAssignmentOfCard(tenantId, assignment.cardId)
                audit.record(tenantId, person, "card.revoked", "card", assignment.cardId, mapOf("reason" to "capture_method_changed"))
            }
        } else {
            devices.revokeActivePersonal(tenantId, id).forEach {
                audit.record(tenantId, person, "device.revoked", "device", it, mapOf("reason" to "capture_method_changed"))
            }
        }
        audit.record(tenantId, person, "employee.capture_method_changed", "employee", id, mapOf("from" to from, "to" to to))
    }

    /** Asigna un horario desde una fecha y cierra el anterior el día previo. */
    @Transactional
    fun assignSchedule(person: CurrentPerson, employeeId: UUID, request: ScheduleAssignmentRequest): ScheduleAssignmentRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val scheduleId = checks.uuid("scheduleId", request.scheduleId, required = true)
        val from = checks.date("validFrom", request.validFrom, required = true)
        checks.done()

        if (!employees.lock(tenantId, employeeId)) throw Problems.notFound()
        if (employees.find(tenantId, employeeId)?.status != "active") {
            throw Problems.conflict("employee_inactive", "No se asignan horarios a una persona dada de baja.")
        }
        val schedule = schedules.find(tenantId, scheduleId!!)
        if (schedule == null) {
            checks.fail("scheduleId", "schedule_not_found", "El horario no existe.")
        } else if (from!! < schedule.validFrom || (schedule.validTo != null && from > schedule.validTo)) {
            checks.fail("validFrom", "outside_schedule_validity", "Queda fuera de la vigencia del horario.")
        }
        val previous = employees.latestAssignment(tenantId, employeeId)
        if (previous != null && previous.validFrom >= from!!) {
            checks.fail("validFrom", "not_after_previous", "Debe ser posterior al inicio de la asignación anterior.")
        }
        checks.done()

        if (previous != null && (previous.validTo == null || previous.validTo >= from!!)) {
            employees.closeAssignment(tenantId, previous.id, from!!.minusDays(1))
        }
        val created = employees.insertAssignment(tenantId, UUID.randomUUID(), employeeId, scheduleId, from!!, schedule!!.validTo)
        audit.record(
            tenantId, person, "employee.schedule_assigned", "employee", employeeId,
            mapOf("scheduleId" to scheduleId.toString(), "validFrom" to from.toString()),
        )
        return created
    }

    private companion object {
        const val MAX_EXTERNAL_ID = 64
        const val MAX_NAME = 160
        val STATUSES = setOf("active", "inactive")
        val UPDATABLE = setOf("displayName", "siteId", "status", "employmentEnd", "captureMethod")
    }
}

@RestController
@RequestMapping("/api/v1/employees")
class EmployeeController(private val service: EmployeeService) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam status: String?,
        @RequestParam siteId: String?,
        @RequestParam scheduleId: String?,
        @RequestParam withoutCard: String?,
        @RequestParam q: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<EmployeeView> {
        val size = Paging.limit(limit)
        val query = EmployeeService.ListQuery(status, siteId, scheduleId, withoutCard, q)
        val rows = service.page(person, query, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.createdAt, it.id) }) { EmployeeView.of(it) }
    }

    @GetMapping("/summary")
    fun summary(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam status: String?,
        @RequestParam siteId: String?,
        @RequestParam q: String?,
    ): EmployeeSummaryView = service.summary(person, EmployeeService.ListQuery(status = status, siteId = siteId, q = q))

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: EmployeeCreateRequest): EmployeeView =
        EmployeeView.of(service.create(person, request))

    @GetMapping("/{employeeId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable employeeId: UUID): EmployeeView =
        EmployeeView.of(service.get(person, employeeId))

    @PatchMapping("/{employeeId}")
    fun update(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable employeeId: UUID,
        @RequestBody body: Map<String, Any?>,
    ): EmployeeView = EmployeeView.of(service.update(person, employeeId, body))

    @GetMapping("/{employeeId}/schedule-assignments")
    fun scheduleAssignments(@AuthenticationPrincipal person: CurrentPerson, @PathVariable employeeId: UUID): ScheduleAssignmentList =
        ScheduleAssignmentList(service.assignments(person, employeeId).map {
            ScheduleAssignmentView(it.id.toString(), it.employeeId.toString(), it.scheduleId.toString(), it.validFrom.toString(), it.validTo?.toString())
        })

    @PostMapping("/{employeeId}/schedule-assignments")
    @ResponseStatus(HttpStatus.CREATED)
    fun assignSchedule(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable employeeId: UUID,
        @RequestBody request: ScheduleAssignmentRequest,
    ): ScheduleAssignmentView {
        val row = service.assignSchedule(person, employeeId, request)
        return ScheduleAssignmentView(
            row.id.toString(), row.employeeId.toString(), row.scheduleId.toString(), row.validFrom.toString(), row.validTo?.toString(),
        )
    }
}
