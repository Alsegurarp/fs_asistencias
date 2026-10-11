package mx.fastsolution.zenit.employee

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.schedule.ScheduleRepository
import mx.fastsolution.zenit.site.SiteRepository
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
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
)

data class ScheduleAssignmentRow(val id: UUID, val employeeId: UUID, val scheduleId: UUID, val validFrom: LocalDate, val validTo: LocalDate?)

class EmployeeCreateRequest {
    var externalId: String? = null
    var displayName: String? = null
    var siteId: String? = null
    var employmentStart: String? = null
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
    val createdAt: String,
    val updatedAt: String,
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
            createdAt = row.createdAt.toInstant().toString(),
            updatedAt = row.updatedAt.toInstant().toString(),
        )
    }
}

data class ScheduleAssignmentView(val id: String, val employeeId: String, val scheduleId: String, val validFrom: String, val validTo: String?)

@Repository
class EmployeeRepository(private val dsl: DSLContext) {
    fun insert(tenantId: UUID, id: UUID, externalId: String, displayName: String, siteId: UUID?, start: LocalDate, source: String) {
        dsl.execute(
            "insert into employee (tenant_id, id, external_id, display_name, status, site_id, employment_start, source) " +
                "values (?, ?, ?, ?, 'active', cast(? as uuid), cast(? as date), ?)",
            tenantId, id, externalId, displayName, siteId, start.toString(), source,
        )
    }

    fun find(tenantId: UUID, id: UUID): EmployeeRow? =
        dsl.fetchOne("$SELECT where e.tenant_id = ? and e.id = ?", tenantId, id)?.let(::row)

    fun findByExternalId(tenantId: UUID, externalId: String): EmployeeRow? =
        dsl.fetchOne("$SELECT where e.tenant_id = ? and e.external_id = ?", tenantId, externalId)?.let(::row)

    /** Pone en fila los cambios sobre una misma persona. */
    fun lock(tenantId: UUID, id: UUID): Boolean =
        dsl.fetchOne("select id from employee where tenant_id = ? and id = ? for update", tenantId, id) != null

    fun page(tenantId: UUID, status: String?, siteId: UUID?, after: PageKey?, limit: Int): List<EmployeeRow> {
        val sql = StringBuilder("$SELECT where e.tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (status != null) {
            sql.append(" and e.status = ?")
            binds += status
        }
        if (siteId != null) {
            sql.append(" and e.site_id = ?")
            binds += siteId
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

    fun update(tenantId: UUID, id: UUID, displayName: String, siteId: UUID?, status: String, start: LocalDate, end: LocalDate?) {
        dsl.execute(
            "update employee set display_name = ?, site_id = cast(? as uuid), status = ?, employment_start = cast(? as date), " +
                "employment_end = cast(? as date), updated_at = now() where tenant_id = ? and id = ?",
            displayName, siteId, status, start.toString(), end?.toString(), tenantId, id,
        )
    }

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
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        updatedAt = r.get("updated_at", OffsetDateTime::class.java),
    )

    private companion object {
        // El horario vigente se calcula con la fecha de hoy en la zona de la empresa.
        const val SELECT =
            "select e.id, e.external_id, e.display_name, e.status, e.site_id, " +
                "cast(e.employment_start as text) as employment_start, cast(e.employment_end as text) as employment_end, " +
                "e.source, e.created_at, e.updated_at, " +
                "(select a.schedule_id from schedule_assignment a where a.tenant_id = e.tenant_id and a.employee_id = e.id " +
                "and a.valid_from <= cast(now() at time zone t.time_zone as date) " +
                "and (a.valid_to is null or a.valid_to >= cast(now() at time zone t.time_zone as date)) " +
                "order by a.valid_from desc limit 1) as current_schedule_id, " +
                "(select c.card_id from card_assignment c where c.tenant_id = e.tenant_id and c.employee_id = e.id " +
                "and c.until is null) as active_card_id " +
                "from employee e join tenant t on t.id = e.tenant_id"
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
        // Una sede de otra empresa no existe para quien pregunta.
        if (siteId != null && sites.find(tenantId, siteId) == null) checks.fail("siteId", "site_not_found", "La sede no existe.")
        checks.done()

        val id = UUID.randomUUID()
        try {
            employees.insert(tenantId, id, externalId!!, displayName!!, siteId, start!!, "manual")
        } catch (e: RuntimeException) {
            throw if (Conflicts.uniqueConstraint(e) == Conflicts.EMPLOYEE_EXTERNAL_ID) Conflicts.externalIdTaken() else e
        }
        audit.record(tenantId, person, "employee.created", "employee", id, mapOf("source" to "manual"))
        return employees.find(tenantId, id)!!
    }

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, status: String?, siteId: String?, after: PageKey?, limit: Int): List<EmployeeRow> {
        val checks = Checks()
        checks.oneOf("status", status, STATUSES, required = false)
        val site = checks.uuid("siteId", siteId, required = false)
        checks.done()
        return employees.page(person.requireTenant(), status, site, after, limit + 1)
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): EmployeeRow = employees.find(person.requireTenant(), id) ?: throw Problems.notFound()

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

        if (!employees.lock(tenantId, id)) throw Problems.notFound()
        val before = employees.find(tenantId, id)!!

        val displayName = if ("displayName" in body) checks.text("displayName", body["displayName"] as String?, MAX_NAME, required = true) else before.displayName
        val status = if ("status" in body) checks.oneOf("status", body["status"] as String?, STATUSES, required = true) else before.status
        val siteId = if ("siteId" in body) checks.uuid("siteId", body["siteId"] as String?, required = false) else before.siteId
        val end = if ("employmentEnd" in body) checks.date("employmentEnd", body["employmentEnd"] as String?, required = false) else before.employmentEnd
        if ("siteId" in body && siteId != null && sites.find(tenantId, siteId) == null) {
            checks.fail("siteId", "site_not_found", "La sede no existe.")
        }
        if (end != null && end < before.employmentStart) {
            checks.fail("employmentEnd", "before_start", "No puede ser anterior al inicio de la relación.")
        }
        checks.done()

        employees.update(tenantId, id, displayName!!, siteId, status!!, before.employmentStart, end)
        val action = when {
            status == before.status -> "employee.updated"
            status == "inactive" -> "employee.deactivated"
            else -> "employee.reactivated"
        }
        audit.record(tenantId, person, action, "employee", id, mapOf("fields" to body.keys.sorted().joinToString(",")))
        return employees.find(tenantId, id)!!
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
        val UPDATABLE = setOf("displayName", "siteId", "status", "employmentEnd")
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
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<EmployeeView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, status, siteId, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.createdAt, it.id) }) { EmployeeView.of(it) }
    }

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
