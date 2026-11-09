package mx.fastsolution.zenit.workday

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.device.DeviceSignal
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.api.TextSearch
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.Role
import mx.fastsolution.zenit.identity.SiteScope
import mx.fastsolution.zenit.tenant.BreakPolicies
import mx.fastsolution.zenit.tenant.TenantRepository
import mx.fastsolution.zenit.tenant.TenantRow
import org.jooq.DSLContext
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.json.JsonMapper
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID

data class IncidentRef(val id: String, val type: String)

data class TodayView(val state: String, val since: String?, val lastMarkAt: String?)

data class AttendanceWeekRowView(
    val employeeId: String,
    val externalId: String,
    val displayName: String,
    val siteId: String?,
    val scheduleId: String?,
    val ruleSet: RuleSetRef,
    val totals: Totals,
    val alerts: List<Alert>,
    val openIncidents: List<IncidentRef>,
    val closure: ClosureRef?,
    val today: TodayView?,
    /** Días con tiempo trabajado y días con tiempo extra; nulos en un cierre anterior a 0.26.0. */
    val workedDays: Int?,
    val overtimeDays: Int?,
)

data class AttendanceWeekListView(val weekStart: String, val timeZone: String, val items: List<AttendanceWeekRowView>, val nextCursor: String?)

data class DayCounts(val marked: Int, val attendanceEvents: Int, val onShift: Int?, val noEntry: Int?, val foreignSite: Int)

data class WeekCounts(val ordinaryMinutes: Int, val overtimeMinutes: Int, val withOvertime: Int, val withAttention: Int, val missingExit: Int)

data class IncidentCounts(val open: Int, val highSeverity: Int, val unassigned: Int)

data class PreviousWeekCounts(val weekStart: String, val people: Int, val closed: Int, val agreed: Int, val objected: Int)

data class DeviceCounts(val active: Int, val silent: Int)

/** Una de las personas con más horas en la semana, para el panel. */
data class HoursRow(val employeeId: String, val displayName: String, val siteId: String?, val ordinaryMinutes: Int, val overtimeMinutes: Int)

data class AttendanceSummaryView(
    val date: String,
    val weekStart: String,
    val timeZone: String,
    val siteId: String?,
    val people: Int,
    val day: DayCounts,
    val week: WeekCounts,
    val incidents: IncidentCounts,
    val previousWeek: PreviousWeekCounts,
    val devices: DeviceCounts?,
    val mostHours: List<HoursRow>,
)

/** Persona que entra a una semana, con lo que la tabla necesita del padrón. */
data class WeekPerson(
    val id: UUID,
    val externalId: String,
    val displayName: String,
    val siteId: UUID?,
    val scheduleId: UUID?,
    val createdAt: OffsetDateTime,
)

/** Cierre vigente o reabierto de una persona, con lo que congeló. */
data class FrozenWeek(
    val id: UUID,
    val version: Int,
    val status: String,
    val ruleSet: RuleSetRef,
    val totals: Totals,
    val alerts: String,
    /** Los días que congeló, como texto; nulo si el cierre es anterior a 0.26.0. */
    val days: String?,
)

/** La semana de una persona ya resuelta: congelada o calculada al momento. */
data class PersonWeek(
    val person: WeekPerson,
    val ruleSet: RuleSetRef,
    val totals: Totals,
    val alerts: List<Alert>,
    val openIncidents: List<IncidentRef>,
    val closure: ClosureRef?,
    val today: TodayView?,
    /** Tramos sin cerrar que ya no son el turno en curso: falta su salida. */
    val staleOpenSegments: Int,
    /** Los días de la semana; nulos si el cierre no los guardó. */
    val days: List<DayTotals>?,
) {
    val needsAttention: Boolean
        get() = openIncidents.isNotEmpty() || staleOpenSegments > 0 ||
            alerts.any { it.severity == "critical" || (it.severity == "warning" && it.code != "open_segment") }

    fun view() = AttendanceWeekRowView(
        person.id.toString(), person.externalId, person.displayName, person.siteId?.toString(), person.scheduleId?.toString(),
        ruleSet, totals, alerts, openIncidents, closure, today,
        days?.count { it.workedMinutes > 0 }, days?.count { it.overtimeMinutes > 0 },
    )
}

/** Un periodo semiabierto en instantes: [from, until). */
data class Window(val from: OffsetDateTime, val until: OffsetDateTime)

/**
 * Lecturas en lote para la asistencia de la empresa. Cada consulta recibe la
 * lista de personas de una página: el número de consultas no crece con ella.
 */
@Repository
class CompanyAttendanceRepository(private val dsl: DSLContext) {
    /**
     * Quién entra a la semana: las activas y las que marcaron en ella, como en
     * un cierre. Supervisión no ve a quien marcó en una sede ajena: un cálculo
     * no se recorta, se oculta completo.
     */
    private fun peopleWhere(tenantId: UUID, week: Window, siteId: UUID?): Pair<String, List<Any>> {
        val sql = StringBuilder(
            "e.tenant_id = ?${SiteScope.clause("e.site_id")} and (e.status = 'active' or exists (select 1 from attendance_event m " +
                "where m.tenant_id = e.tenant_id and m.employee_id = e.id and m.observed_at >= cast(? as timestamptz) " +
                "and m.observed_at < cast(? as timestamptz)))",
        )
        val binds = mutableListOf<Any>(tenantId, week.from, week.until)
        if (siteId != null) {
            sql.append(" and e.site_id = ?")
            binds += siteId
        }
        if (SiteScope.current() != null) {
            // El mismo margen de un día que lee el cálculo.
            sql.append(
                " and not exists (select 1 from attendance_event se where se.tenant_id = e.tenant_id and se.employee_id = e.id " +
                    "and se.observed_at >= cast(? as timestamptz) and se.observed_at < cast(? as timestamptz) " +
                    "and not coalesce((true${SiteScope.clause("se.site_id")}), false))",
            )
            binds += week.from.minusDays(1)
            binds += week.until.plusDays(1)
        }
        return sql.toString() to binds
    }

    /** `text`, patrón de [TextSearch]: sólo la tabla lo usa; los conteos del panel no. */
    fun people(tenantId: UUID, week: Window, siteId: UUID?, scheduleOn: LocalDate, after: PageKey?, limit: Int, text: String? = null): List<WeekPerson> {
        val (where, whereBinds) = peopleWhere(tenantId, week, siteId)
        val sql = StringBuilder(
            "select e.id, e.external_id, e.display_name, e.site_id, e.created_at, " +
                "(select a.schedule_id from schedule_assignment a where a.tenant_id = e.tenant_id and a.employee_id = e.id " +
                "and a.valid_from <= cast(? as date) and (a.valid_to is null or a.valid_to >= cast(? as date)) " +
                "order by a.valid_from desc limit 1) as schedule_id from employee e where $where",
        )
        val binds = mutableListOf<Any>(scheduleOn.toString(), scheduleOn.toString())
        binds.addAll(whereBinds)
        if (text != null) {
            sql.append(TextSearch.clause("e.display_name", "e.external_id"))
            binds.addAll(TextSearch.binds(text, 2))
        }
        if (after != null) {
            sql.append(" and (e.created_at, e.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by e.created_at, e.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map {
            WeekPerson(
                it.get("id", UUID::class.java), it.get("external_id", String::class.java), it.get("display_name", String::class.java),
                it.get("site_id", UUID::class.java), it.get("schedule_id", UUID::class.java), it.get("created_at", OffsetDateTime::class.java),
            )
        }
    }

    /** Personas que marcaron en el periodo y cuántos marcajes dejaron, entre las que entran a la semana. */
    fun marked(tenantId: UUID, week: Window, siteId: UUID?, period: Window): Pair<Int, Int> {
        val (where, whereBinds) = peopleWhere(tenantId, week, siteId)
        val binds = mutableListOf<Any>(tenantId, period.from, period.until)
        binds.addAll(whereBinds)
        val r = dsl.fetchOne(
            "select count(distinct a.employee_id) as people, count(*) as events from attendance_event a where a.tenant_id = ? " +
                "and a.observed_at >= cast(? as timestamptz) and a.observed_at < cast(? as timestamptz) " +
                "and a.employee_id in (select e.id from employee e where $where)",
            *binds.toTypedArray(),
        )!!
        return r.get("people", Int::class.java) to r.get("events", Int::class.java)
    }

    fun frozen(tenantId: UUID, weekStart: LocalDate, ids: List<UUID>): Map<UUID, FrozenWeek> =
        dsl.fetch(
            "select distinct on (employee_id) employee_id, id, version, status, rule_set_id, rule_set_version, worked_minutes, " +
                "break_minutes, ordinary_minutes, overtime_minutes, cast(snapshot -> 'alerts' as text) as alerts, " +
                "cast(snapshot -> 'days' as text) as days from week_closure " +
                "where tenant_id = ? and week_start = cast(? as date) and employee_id = any(?) " +
                "order by employee_id, version desc",
            tenantId, weekStart.toString(), array(ids),
        ).associate {
            it.get("employee_id", UUID::class.java) to FrozenWeek(
                it.get("id", UUID::class.java), it.get("version", Int::class.java), it.get("status", String::class.java),
                RuleSetRef(it.get("rule_set_id", UUID::class.java).toString(), it.get("rule_set_version", Int::class.java)),
                Totals(
                    it.get("worked_minutes", Int::class.java), it.get("break_minutes", Int::class.java),
                    it.get("ordinary_minutes", Int::class.java), it.get("overtime_minutes", Int::class.java),
                ),
                it.get("alerts", String::class.java),
                it.get("days", String::class.java),
            )
        }

    fun marks(tenantId: UUID, ids: List<UUID>, period: Window): Map<UUID, List<RawMark>> =
        dsl.fetch(
            "select employee_id, id, observed_at, declared_type from attendance_event where tenant_id = ? " +
                "and employee_id = any(?) and observed_at >= cast(? as timestamptz) and observed_at < cast(? as timestamptz) " +
                "order by employee_id, observed_at, received_at",
            tenantId, array(ids), period.from, period.until,
        ).groupBy({ it.get("employee_id", UUID::class.java) }) {
            RawMark(it.get("id", UUID::class.java), it.get("observed_at", OffsetDateTime::class.java), it.get("declared_type", String::class.java))
        }

    /** Igual que `WeekRepository.adjustments`, para varias personas. */
    fun adjustments(tenantId: UUID, ids: List<UUID>, period: Window): Map<UUID, List<AdjustmentRow>> =
        dsl.fetch(
            "select a.employee_id, a.id, a.kind, a.event_id, a.event_type, a.occurred_at from adjustment a " +
                "left join attendance_event e on e.tenant_id = a.tenant_id and e.id = a.event_id " +
                "where a.tenant_id = ? and a.employee_id = any(?) and coalesce(a.occurred_at, e.observed_at) >= cast(? as timestamptz) " +
                "and coalesce(a.occurred_at, e.observed_at) < cast(? as timestamptz) order by a.employee_id, a.created_at, a.id",
            tenantId, array(ids), period.from, period.until,
        ).groupBy({ it.get("employee_id", UUID::class.java) }) {
            AdjustmentRow(
                it.get("id", UUID::class.java), it.get("kind", String::class.java), it.get("event_id", UUID::class.java),
                it.get("event_type", String::class.java), it.get("occurred_at", OffsetDateTime::class.java),
            )
        }

    /** Igual que `WeekRepository.openIncidents`, con su tipo. */
    fun openIncidents(tenantId: UUID, ids: List<UUID>, week: Window): Map<UUID, List<IncidentRef>> =
        dsl.fetch(
            "select i.employee_id, i.id, i.type from incident i join attendance_event e on e.tenant_id = i.tenant_id and e.id = i.event_id " +
                "where i.tenant_id = ? and i.employee_id = any(?) and i.status = 'open' " +
                "and e.observed_at >= cast(? as timestamptz) and e.observed_at < cast(? as timestamptz) order by i.created_at, i.id",
            tenantId, array(ids), week.from, week.until,
        ).groupBy({ it.get("employee_id", UUID::class.java) }) {
            IncidentRef(it.get("id", UUID::class.java).toString(), it.get("type", String::class.java))
        }

    /** Con el alcance de `listIncidents`: por la sede de la incidencia. */
    fun incidents(tenantId: UUID, siteId: UUID?, day: Window): Pair<IncidentCounts, Int> {
        val site = if (siteId != null) " and i.site_id = ?" else ""
        val binds = mutableListOf<Any>(day.from, day.until, tenantId)
        if (siteId != null) binds += siteId
        val r = dsl.fetchOne(
            "select count(*) as open, count(*) filter (where i.type = 'clock_anomaly') as high, " +
                "count(*) filter (where i.assignee_user_id is null) as unassigned, " +
                "count(*) filter (where i.type = 'foreign_site' and e.observed_at >= cast(? as timestamptz) " +
                "and e.observed_at < cast(? as timestamptz)) as foreign_site " +
                "from incident i left join attendance_event e on e.tenant_id = i.tenant_id and e.id = i.event_id " +
                "where i.tenant_id = ? and i.status = 'open'${SiteScope.clause("i.site_id")}$site",
            *binds.toTypedArray(),
        )!!
        return IncidentCounts(r.get("open", Int::class.java), r.get("high", Int::class.java), r.get("unassigned", Int::class.java)) to
            r.get("foreign_site", Int::class.java)
    }

    /** Cierres vigentes de una semana y sus acuses, entre las personas que entran a ella. */
    fun closures(tenantId: UUID, weekStart: LocalDate, week: Window, siteId: UUID?): PreviousWeekCounts {
        val (where, whereBinds) = peopleWhere(tenantId, week, siteId)
        val binds = mutableListOf<Any>(weekStart.toString())
        binds.addAll(whereBinds)
        val r = dsl.fetchOne(
            "select count(*) as people, count(c.id) as closed, count(*) filter (where k.type = 'agreed') as agreed, " +
                "count(*) filter (where k.type = 'objected') as objected from employee e " +
                "left join week_closure c on c.tenant_id = e.tenant_id and c.employee_id = e.id and c.week_start = cast(? as date) " +
                "and c.status = 'closed' left join closure_acknowledgement k on k.tenant_id = c.tenant_id and k.closure_id = c.id " +
                "where $where",
            *binds.toTypedArray(),
        )!!
        return PreviousWeekCounts(
            weekStart.toString(), r.get("people", Int::class.java), r.get("closed", Int::class.java),
            r.get("agreed", Int::class.java), r.get("objected", Int::class.java),
        )
    }

    /** Terminales de la sede y teléfonos personales de su gente. */
    fun devices(tenantId: UUID, siteId: UUID?, silentBefore: OffsetDateTime): DeviceCounts {
        val site = if (siteId != null) {
            " and (d.site_id = ? or exists (select 1 from employee de where de.tenant_id = d.tenant_id and de.id = d.employee_id and de.site_id = ?))"
        } else {
            ""
        }
        val binds = mutableListOf<Any>(silentBefore, tenantId)
        if (siteId != null) {
            binds += siteId
            binds += siteId
        }
        val r = dsl.fetchOne(
            "select count(*) as active, count(*) filter (where d.last_seen_at is null or d.last_seen_at < cast(? as timestamptz)) as silent " +
                "from device d where d.tenant_id = ? and d.status = 'active'$site",
            *binds.toTypedArray(),
        )!!
        return DeviceCounts(r.get("active", Int::class.java), r.get("silent", Int::class.java))
    }

    /**
     * La lista viaja como `uuid[]`: PostgreSQL la lee una vez. Como texto con
     * `cast(? as uuid[])` la vuelve a convertir en cada fila que filtra, y con
     * 200 personas eso costaba cientos de milisegundos.
     */
    private fun array(ids: List<UUID>): Array<UUID> = ids.toTypedArray()
}

@Service
class CompanyAttendanceService(
    private val repository: CompanyAttendanceRepository,
    private val weeks: WeekService,
    private val tenants: TenantRepository,
    private val policies: BreakPolicies,
    private val json: JsonMapper,
) {
    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, week: String?, siteId: String?, attention: String?, q: String?, after: PageKey?, limit: Int): AttendanceWeekListView {
        val checks = Checks()
        val day = checks.date("week", week, required = true)
        val site = checks.uuid("siteId", siteId, required = false)
        checks.oneOf("attention", attention, ATTENTION, required = false)
        val text = TextSearch.pattern(checks, q)
        checks.done()
        val tenant = tenants.find(person.requireTenant()) ?: throw Problems.notFound()
        val zone = ZoneId.of(tenant.timeZone)
        val today = LocalDate.now(zone)
        val weekStart = WeekCalculator.weekStart(day!!, tenant.weekStartsOn)
        if (attention in TODAY_ONLY && !contains(weekStart, today)) {
            throw Problems.validation("attention", "not_current_week", "Ese filtro sólo aplica a la semana de hoy.")
        }
        val window = window(weekStart, zone)
        val scheduleOn = if (contains(weekStart, today)) today else weekStart.plusDays(6)

        val matches = mutableListOf<PersonWeek>()
        var cursor = after
        // Sin filtro basta una página y una fila de más. Con filtro se recorre
        // por lotes hasta llenarla: el filtro sale del cálculo, no de la base.
        val batch = if (attention == null) limit + 1 else BATCH
        while (true) {
            val people = repository.people(tenant.id, window, site, scheduleOn, cursor, batch, text)
            for (week in resolve(tenant, people, weekStart, today)) {
                if (passes(week, attention)) matches += week
                if (matches.size > limit) break
            }
            if (attention == null || matches.size > limit || people.size < batch) break
            cursor = people.last().let { PageKey(it.createdAt, it.id) }
        }
        val page = Paging.page(matches, limit, { PageKey(it.person.createdAt, it.person.id) }) { it.view() }
        return AttendanceWeekListView(weekStart.toString(), tenant.timeZone, page.items, page.nextCursor)
    }

    @Transactional(readOnly = true)
    fun summary(person: CurrentPerson, date: String?, siteId: String?): AttendanceSummaryView {
        val checks = Checks()
        val requested = checks.date("date", date, required = false)
        val site = checks.uuid("siteId", siteId, required = false)
        checks.done()
        val tenant = tenants.find(person.requireTenant()) ?: throw Problems.notFound()
        val zone = ZoneId.of(tenant.timeZone)
        val today = LocalDate.now(zone)
        val day = requested ?: today
        if (day > today) throw Problems.validation("date", "future_date", "Ese día todavía no llega.")
        val weekStart = WeekCalculator.weekStart(day, tenant.weekStartsOn)
        val window = window(weekStart, zone)
        val scheduleOn = if (contains(weekStart, today)) today else weekStart.plusDays(6)

        // Todas las personas del alcance, por lotes: cada lote, un número fijo de consultas.
        val resolved = mutableListOf<PersonWeek>()
        var cursor: PageKey? = null
        do {
            val people = repository.people(tenant.id, window, site, scheduleOn, cursor, BATCH)
            resolved += resolve(tenant, people, weekStart, today)
            cursor = people.lastOrNull()?.let { PageKey(it.createdAt, it.id) }
        } while (people.size == BATCH)

        val isToday = day == today
        val (marked, events) = repository.marked(tenant.id, window, site, window(day, day.plusDays(1), zone))
        val (incidents, foreignSite) = repository.incidents(tenant.id, site, window(day, day.plusDays(1), zone))
        val previousStart = weekStart.minusDays(7)
        val seesDevices = person.roles.any { it in DEVICE_READERS }
        return AttendanceSummaryView(
            date = day.toString(),
            weekStart = weekStart.toString(),
            timeZone = tenant.timeZone,
            siteId = site?.toString(),
            people = resolved.size,
            day = DayCounts(
                marked = marked,
                attendanceEvents = events,
                onShift = if (isToday) resolved.count { it.today?.state in ON_SHIFT } else null,
                noEntry = if (isToday) resolved.count { it.today?.state == "no_entry" } else null,
                foreignSite = foreignSite,
            ),
            week = WeekCounts(
                ordinaryMinutes = resolved.sumOf { it.totals.ordinaryMinutes },
                overtimeMinutes = resolved.sumOf { it.totals.overtimeMinutes },
                withOvertime = resolved.count { it.totals.overtimeMinutes > 0 },
                withAttention = resolved.count { it.needsAttention },
                missingExit = resolved.count { it.staleOpenSegments > 0 },
            ),
            incidents = incidents,
            previousWeek = repository.closures(tenant.id, previousStart, window(previousStart, zone), site),
            devices = if (seesDevices) repository.devices(tenant.id, site, OffsetDateTime.now().minus(DeviceSignal.SILENT_AFTER)) else null,
            mostHours = mostHours(resolved),
        )
    }

    /**
     * La semana de cada persona: la congelada si está cerrada; si no, el mismo
     * cálculo de `getEmployeeWeek`, con marcajes y ajustes leídos en lote.
     */
    private fun resolve(tenant: TenantRow, people: List<WeekPerson>, weekStart: LocalDate, today: LocalDate): List<PersonWeek> {
        if (people.isEmpty()) return emptyList()
        val zone = ZoneId.of(tenant.timeZone)
        val week = window(weekStart, zone)
        val ids = people.map { it.id }
        val frozen = repository.frozen(tenant.id, weekStart, ids)
        val incidents = repository.openIncidents(tenant.id, ids, week)
        val live = ids.filter { frozen[it]?.status != "closed" }
        val margin = Window(week.from.minusDays(1), week.until.plusDays(1))
        val marks = if (live.isEmpty()) emptyMap() else repository.marks(tenant.id, live, margin)
        val adjustments = if (live.isEmpty()) emptyMap() else repository.adjustments(tenant.id, live, margin)
        val ruleSet = if (live.isEmpty()) null else weeks.ruleSetFor(weekStart)
        val breakPolicy = if (live.isEmpty()) null else policies.on(tenant, weekStart)
        val current = contains(weekStart, today)
        val now = Instant.now()
        val gap = weeks.shiftGap()

        return people.map { person ->
            val closure = frozen[person.id]
            val open = incidents[person.id].orEmpty()
            val reference = closure?.let { ClosureRef(it.id.toString(), it.version, it.status) }
            if (closure != null && closure.status == "closed") {
                // Una semana cerrada ya terminó: no hay turno en curso ni tramos abiertos.
                return@map PersonWeek(person, closure.ruleSet, closure.totals, alerts(closure.alerts), open, reference, null, 0, days(closure.days))
            }
            val personMarks = marks[person.id].orEmpty()
            val calculation = weeks.calculate(personMarks, adjustments[person.id].orEmpty(), breakPolicy!!, weekStart, zone, ruleSet!!)
            val ongoing = calculation.segments.lastOrNull()?.takeIf {
                it.endAt == null && Duration.between(Instant.parse(it.startAt), now) < gap
            }
            val stale = calculation.segments.count { it.endAt == null && it !== ongoing }
            val todayView = if (!current) {
                null
            } else {
                val todays = personMarks.filter { it.at.atZoneSameInstant(zone).toLocalDate() == today }
                TodayView(
                    state = when {
                        ongoing != null -> if (ongoing.kind == "break") "on_break" else "on_shift"
                        todays.isNotEmpty() -> "off_shift"
                        else -> "no_entry"
                    },
                    since = ongoing?.startAt,
                    lastMarkAt = todays.maxOfOrNull { it.at }?.toInstant()?.toString(),
                )
            }
            PersonWeek(
                person, RuleSetRef(ruleSet.id.toString(), ruleSet.version), calculation.totals, calculation.alerts,
                open, reference, todayView, stale, calculation.days,
            )
        }
    }

    /**
     * Quienes más horas llevan en la semana, ordinarias más extra. Sale del
     * mismo cálculo que el resto del panel: ordenar la tabla por horas
     * obligaría a calcular a todas las personas en cada página.
     */
    private fun mostHours(resolved: List<PersonWeek>): List<HoursRow> =
        resolved.filter { it.totals.ordinaryMinutes + it.totals.overtimeMinutes > 0 }
            .sortedWith(compareByDescending<PersonWeek> { it.totals.ordinaryMinutes + it.totals.overtimeMinutes }.thenBy { it.person.displayName }.thenBy { it.person.id })
            .take(MOST_HOURS)
            .map { HoursRow(it.person.id.toString(), it.person.displayName, it.person.siteId?.toString(), it.totals.ordinaryMinutes, it.totals.overtimeMinutes) }

    private fun passes(week: PersonWeek, attention: String?): Boolean = when (attention) {
        null -> true
        "alerts" -> week.needsAttention
        "overtime" -> week.totals.overtimeMinutes > 0
        "no_entry_today" -> week.today?.state == "no_entry"
        else -> week.today?.state in ON_SHIFT
    }

    /** Los días que congeló un cierre; nulos si es anterior a 0.26.0. */
    private fun days(raw: String?): List<DayTotals>? {
        if (raw.isNullOrBlank() || raw == "null") return null
        val node = json.readTree(raw)
        return (0 until node.size()).map { index ->
            val day = node.get(index)
            DayTotals(
                day.get("date").asString(), day.get("workedMinutes").asInt(), day.get("breakMinutes").asInt(),
                day.get("ordinaryMinutes").asInt(), day.get("overtimeMinutes").asInt(),
            )
        }
    }

    /** Las alertas que congeló un cierre, tal como las guardó. */
    private fun alerts(raw: String?): List<Alert> {
        if (raw.isNullOrBlank()) return emptyList()
        val node = json.readTree(raw)
        return (0 until node.size()).map { index ->
            val alert = node.get(index)
            Alert(alert.get("code").asString(), alert.get("severity").asString(), alert.get("message").asString())
        }
    }

    private fun contains(weekStart: LocalDate, day: LocalDate) = !day.isBefore(weekStart) && day.isBefore(weekStart.plusDays(7))

    private fun window(weekStart: LocalDate, zone: ZoneId) = window(weekStart, weekStart.plusDays(7), zone)

    private fun window(from: LocalDate, until: LocalDate, zone: ZoneId) =
        Window(from.atStartOfDay(zone).toOffsetDateTime(), until.atStartOfDay(zone).toOffsetDateTime())

    private companion object {
        /** Personas por consulta: el mismo tope de una página. */
        const val BATCH = Paging.MAX_LIMIT
        const val MOST_HOURS = 5
        val ATTENTION = setOf("alerts", "overtime", "no_entry_today", "on_shift")
        val TODAY_ONLY = setOf("no_entry_today", "on_shift")
        val ON_SHIFT = setOf("on_shift", "on_break")
        val DEVICE_READERS = setOf(Role.ADMIN_EMPRESA, Role.RH, Role.AUDITOR)
    }
}

@RestController
@RequestMapping("/api/v1/attendance")
class CompanyAttendanceController(private val service: CompanyAttendanceService) {
    @GetMapping("/weeks")
    fun weeks(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam week: String?,
        @RequestParam siteId: String?,
        @RequestParam attention: String?,
        @RequestParam q: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): AttendanceWeekListView = service.page(person, week, siteId, attention, q, Paging.decode(cursor), Paging.limit(limit))

    @GetMapping("/summary")
    fun summary(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam date: String?,
        @RequestParam siteId: String?,
    ): AttendanceSummaryView = service.summary(person, date, siteId)
}
