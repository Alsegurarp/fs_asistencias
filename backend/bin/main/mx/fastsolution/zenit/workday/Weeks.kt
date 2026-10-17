package mx.fastsolution.zenit.workday

import com.fasterxml.jackson.annotation.JsonRawValue
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.capture.CaptureProperties
import mx.fastsolution.zenit.device.CurrentDevice
import mx.fastsolution.zenit.employee.EmployeeRepository
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.tenant.TenantRepository
import mx.fastsolution.zenit.tenant.TenantRow
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.security.core.Authentication
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.json.JsonMapper
import java.time.Duration
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.util.UUID

data class RuleSetRow(
    val id: UUID,
    val jurisdiction: String,
    val version: Int,
    val validFrom: LocalDate,
    val validTo: LocalDate?,
    val weeklyOrdinaryMaxMinutes: Int,
    /** JSON tal como lo guarda la base. */
    val parameters: String,
    val sources: String,
    val limits: RuleLimits,
)

data class RuleSetView(
    val id: String,
    val jurisdiction: String,
    val version: Int,
    val validFrom: String,
    val validTo: String?,
    val weeklyOrdinaryMaxMinutes: Int,
    @get:JsonRawValue val parameters: String,
    @get:JsonRawValue val sources: String,
)

data class RuleSetList(val items: List<RuleSetView>)

data class RuleSetRef(val id: String, val version: Int)

data class ClosureRef(val id: String, val version: Int, val status: String)

/** Lo que un cierre congela: el cálculo completo de la semana de una persona. */
data class WeekCore(
    val employeeId: String,
    val weekStart: String,
    val timeZone: String,
    val ruleSet: RuleSetRef,
    val segments: List<Segment>,
    val totals: Totals,
    val alerts: List<Alert>,
)

/** La semana que se entrega: calculada al momento o, si está cerrada, tal como se congeló. */
data class WeekAttendanceView(
    val employeeId: String,
    val weekStart: String,
    val timeZone: String,
    @get:JsonRawValue val ruleSet: String,
    @get:JsonRawValue val segments: String,
    @get:JsonRawValue val totals: String,
    @get:JsonRawValue val alerts: String,
    val openIncidentIds: List<String>,
    val closure: ClosureRef?,
)

data class ComputedWeek(val core: WeekCore, val rules: RuleSetRow, val openIncidentIds: List<UUID>, val hasOpenSegment: Boolean)

data class ClosureState(val id: UUID, val version: Int, val status: String, val ruleSet: String, val segments: String, val totals: String, val alerts: String)

@Repository
class RuleRepository(private val dsl: DSLContext) {
    fun all(): List<RuleSetRow> = dsl.fetch("$SELECT order by valid_from, version").map { row(it) }

    /** La versión más reciente de las reglas que valen en esa fecha. */
    fun effectiveOn(date: LocalDate): RuleSetRow? =
        dsl.fetchOne(
            "$SELECT where valid_from <= cast(? as date) and (valid_to is null or valid_to >= cast(? as date)) " +
                "order by valid_from desc, version desc limit 1",
            date.toString(), date.toString(),
        )?.let(::row)

    private fun row(r: Record) = RuleSetRow(
        id = r.get("id", UUID::class.java),
        jurisdiction = r.get("jurisdiction", String::class.java),
        version = r.get("version", Number::class.java).toInt(),
        validFrom = LocalDate.parse(r.get("valid_from", String::class.java)),
        validTo = r.get("valid_to", String::class.java)?.let(LocalDate::parse),
        weeklyOrdinaryMaxMinutes = r.get("weekly_ordinary_max_minutes", Number::class.java).toInt(),
        parameters = r.get("parameters", String::class.java),
        sources = r.get("sources", String::class.java),
        limits = RuleLimits(
            r.get("weekly_ordinary_max_minutes", Number::class.java).toInt(),
            r.get("weekly_overtime", String::class.java)?.toIntOrNull(),
            r.get("daily_combined", String::class.java)?.toIntOrNull(),
        ),
    )

    private companion object {
        const val SELECT =
            "select id, jurisdiction, version, cast(valid_from as text) as valid_from, cast(valid_to as text) as valid_to, " +
                "weekly_ordinary_max_minutes, cast(parameters as text) as parameters, cast(sources as text) as sources, " +
                "parameters ->> 'weeklyOvertimeMaxMinutes' as weekly_overtime, " +
                "parameters ->> 'dailyCombinedMaxMinutes' as daily_combined from rule_set"
    }
}

@Repository
class WeekRepository(private val dsl: DSLContext) {
    fun marks(tenantId: UUID, employeeId: UUID, from: OffsetDateTime, until: OffsetDateTime): List<RawMark> =
        dsl.fetch(
            "select id, observed_at, declared_type from attendance_event where tenant_id = ? and employee_id = ? " +
                "and observed_at >= cast(? as timestamptz) and observed_at < cast(? as timestamptz) order by observed_at, received_at",
            tenantId, employeeId, from, until,
        ).map { RawMark(it.get("id", UUID::class.java), it.get("observed_at", OffsetDateTime::class.java), it.get("declared_type", String::class.java)) }

    /** Ajustes cuyo efecto cae en ese periodo: por la hora que agregan o por la del marcaje que tocan. */
    fun adjustments(tenantId: UUID, employeeId: UUID, from: OffsetDateTime, until: OffsetDateTime): List<AdjustmentRow> =
        dsl.fetch(
            "select a.id, a.kind, a.event_id, a.event_type, a.occurred_at from adjustment a " +
                "left join attendance_event e on e.tenant_id = a.tenant_id and e.id = a.event_id " +
                "where a.tenant_id = ? and a.employee_id = ? and coalesce(a.occurred_at, e.observed_at) >= cast(? as timestamptz) " +
                "and coalesce(a.occurred_at, e.observed_at) < cast(? as timestamptz) order by a.created_at, a.id",
            tenantId, employeeId, from, until,
        ).map {
            AdjustmentRow(
                it.get("id", UUID::class.java), it.get("kind", String::class.java), it.get("event_id", UUID::class.java),
                it.get("event_type", String::class.java), it.get("occurred_at", OffsetDateTime::class.java),
            )
        }

    fun openIncidents(tenantId: UUID, employeeId: UUID, from: OffsetDateTime, until: OffsetDateTime): List<UUID> =
        dsl.fetch(
            "select i.id from incident i join attendance_event e on e.tenant_id = i.tenant_id and e.id = i.event_id " +
                "where i.tenant_id = ? and i.employee_id = ? and i.status = 'open' and e.observed_at >= cast(? as timestamptz) " +
                "and e.observed_at < cast(? as timestamptz) order by i.created_at, i.id",
            tenantId, employeeId, from, until,
        ).map { it.get("id", UUID::class.java) }

    /** El cierre más reciente de esa persona y semana, con el cálculo que congeló. */
    fun latestClosure(tenantId: UUID, employeeId: UUID, weekStart: LocalDate): ClosureState? =
        dsl.fetchOne(
            "select id, version, status, cast(snapshot -> 'ruleSet' as text) as rule_set, cast(snapshot -> 'segments' as text) as segments, " +
                "cast(snapshot -> 'totals' as text) as totals, cast(snapshot -> 'alerts' as text) as alerts from week_closure " +
                "where tenant_id = ? and employee_id = ? and week_start = cast(? as date) order by version desc limit 1",
            tenantId, employeeId, weekStart.toString(),
        )?.let {
            ClosureState(
                it.get("id", UUID::class.java), it.get("version", Number::class.java).toInt(), it.get("status", String::class.java),
                it.get("rule_set", String::class.java), it.get("segments", String::class.java), it.get("totals", String::class.java),
                it.get("alerts", String::class.java),
            )
        }
}

@Service
class WeekService(
    private val weeks: WeekRepository,
    private val rules: RuleRepository,
    private val employees: EmployeeRepository,
    private val tenants: TenantRepository,
    private val capture: CaptureProperties,
    private val json: JsonMapper,
) {
    @Transactional(readOnly = true)
    fun ruleSets(effectiveOn: String?): List<RuleSetRow> {
        if (effectiveOn.isNullOrBlank()) return rules.all()
        return listOfNotNull(rules.effectiveOn(date("effectiveOn", effectiveOn)))
    }

    /** La semana de una persona. Cerrada, se entrega tal como se congeló; si no, se calcula al momento. */
    @Transactional(readOnly = true)
    fun view(tenantId: UUID, employeeId: UUID, week: String?): WeekAttendanceView {
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        if (employees.find(tenantId, employeeId) == null) throw Problems.notFound()
        val weekStart = WeekCalculator.weekStart(date("week", week), tenant.weekStartsOn)
        val closure = weeks.latestClosure(tenantId, employeeId, weekStart)
        val reference = closure?.let { ClosureRef(it.id.toString(), it.version, it.status) }
        if (closure != null && closure.status == "closed") {
            // El cálculo es el que se congeló. Las incidencias abiertas sí son las de ahora:
            // un marcaje que llegó después del cierre deja una, y así se ve que hay algo por revisar.
            val zone = ZoneId.of(tenant.timeZone)
            val open = weeks.openIncidents(
                tenantId, employeeId, weekStart.atStartOfDay(zone).toOffsetDateTime(), weekStart.plusDays(7).atStartOfDay(zone).toOffsetDateTime(),
            )
            return WeekAttendanceView(
                employeeId.toString(), weekStart.toString(), tenant.timeZone, closure.ruleSet, closure.segments, closure.totals,
                closure.alerts, open.map { it.toString() }, reference,
            )
        }
        val computed = compute(tenant, employeeId, weekStart)
        return WeekAttendanceView(
            employeeId.toString(), weekStart.toString(), tenant.timeZone, json.writeValueAsString(computed.core.ruleSet),
            json.writeValueAsString(computed.core.segments), json.writeValueAsString(computed.core.totals),
            json.writeValueAsString(computed.core.alerts), computed.openIncidentIds.map { it.toString() }, reference,
        )
    }

    /** Calcula la semana con las reglas vigentes en su último día: la reducción de un año nuevo aplica desde su primera semana. */
    fun compute(tenant: TenantRow, employeeId: UUID, weekStart: LocalDate): ComputedWeek {
        val zone = ZoneId.of(tenant.timeZone)
        val ruleSet = rules.effectiveOn(weekStart.plusDays(6))
            ?: throw Problems.validation("week", "no_rules_for_date", "No hay reglas laborales registradas para esa semana.")
        val from = weekStart.atStartOfDay(zone).toOffsetDateTime()
        val until = weekStart.plusDays(7).atStartOfDay(zone).toOffsetDateTime()
        // Un día de margen a cada lado: un turno puede empezar o terminar fuera de la semana.
        val marks = weeks.marks(tenant.id, employeeId, from.minusDays(1), until.plusDays(1))
        val adjustments = weeks.adjustments(tenant.id, employeeId, from.minusDays(1), until.plusDays(1))
        val calculation = WeekCalculator.calculate(
            marks, adjustments, tenant.breakPolicy, weekStart, zone, ruleSet.limits,
            Duration.ofSeconds(capture.duplicateWindowSeconds), Duration.ofHours(capture.shiftGapHours),
        )
        val core = WeekCore(
            employeeId.toString(), weekStart.toString(), tenant.timeZone, RuleSetRef(ruleSet.id.toString(), ruleSet.version),
            calculation.segments, calculation.totals, calculation.alerts,
        )
        return ComputedWeek(core, ruleSet, weeks.openIncidents(tenant.id, employeeId, from, until), calculation.hasOpenSegment)
    }

    fun snapshot(core: WeekCore): String = json.writeValueAsString(core)

    private fun date(field: String, raw: String?): LocalDate {
        if (raw.isNullOrBlank()) throw Problems.validation(field, "required", "Es obligatorio.")
        return try {
            LocalDate.parse(raw)
        } catch (e: DateTimeParseException) {
            throw Problems.validation(field, "invalid_date", "Debe ser una fecha AAAA-MM-DD.")
        }
    }
}

@RestController
@RequestMapping("/api/v1")
class WeekController(private val service: WeekService) {
    @GetMapping("/employees/{employeeId}/attendance")
    fun ofEmployee(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable employeeId: UUID,
        @RequestParam week: String?,
    ): WeekAttendanceView = service.view(person.requireTenant(), employeeId, week)

    /**
     * La semana de quien consulta: una persona ligada a su fila del padrón, o
     * el teléfono personal de un trabajador. Una terminal no puede consultarla.
     */
    @GetMapping("/me/attendance")
    fun mine(authentication: Authentication, @RequestParam week: String?): WeekAttendanceView {
        val (tenantId, employeeId) = Worker.of(authentication)
        return service.view(tenantId, employeeId, week)
    }

    @GetMapping("/rule-sets")
    fun ruleSets(@RequestParam effectiveOn: String?): RuleSetList = RuleSetList(
        service.ruleSets(effectiveOn).map {
            RuleSetView(
                it.id.toString(), it.jurisdiction, it.version, it.validFrom.toString(), it.validTo?.toString(),
                it.weeklyOrdinaryMaxMinutes, it.parameters, it.sources,
            )
        },
    )
}

/** El trabajador que llama, venga con su cuenta o con su teléfono personal. */
object Worker {
    /** Devuelve su empresa y su fila del padrón; sin fila del padrón no hay nada suyo que ver. */
    fun of(authentication: Authentication): Pair<UUID, UUID> = when (val principal = authentication.principal) {
        is CurrentPerson -> principal.requireTenant() to (principal.employeeId ?: throw Problems.forbidden())
        is CurrentDevice -> principal.tenantId to (principal.employeeId ?: throw Problems.forbidden())
        else -> throw Problems.forbidden()
    }

    fun actor(authentication: Authentication): Pair<String, String> = when (val principal = authentication.principal) {
        is CurrentPerson -> "user" to principal.actorId
        is CurrentDevice -> "device" to principal.id.toString()
        else -> throw Problems.forbidden()
    }
}
