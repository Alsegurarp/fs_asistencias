package mx.fastsolution.zenit.schedule

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpStatus
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
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID

data class ScheduleDay(val dayOfWeek: String, val startTime: LocalTime, val endTime: LocalTime, val breakMinutes: Int) {
    /** Si la salida es menor que la entrada, el turno termina al día siguiente. */
    val minutes: Long
        get() = Duration.between(startTime, endTime).toMinutes().let { if (it <= 0) it + MINUTES_PER_DAY else it }

    private companion object {
        const val MINUTES_PER_DAY = 24 * 60L
    }
}

data class ScheduleRow(
    val id: UUID,
    val name: String,
    val timeZone: String,
    val validFrom: LocalDate,
    val validTo: LocalDate?,
    val createdAt: OffsetDateTime,
    val days: List<ScheduleDay>,
)

class ScheduleDayRequest {
    var dayOfWeek: String? = null
    var startTime: String? = null
    var endTime: String? = null
    var breakMinutes: Int? = null
}

class ScheduleRequest {
    var name: String? = null
    var timeZone: String? = null
    var validFrom: String? = null
    var validTo: String? = null
    var days: List<ScheduleDayRequest>? = null
}

data class ScheduleDayView(val dayOfWeek: String, val startTime: String, val endTime: String, val breakMinutes: Int)

data class ScheduleView(
    val id: String,
    val name: String,
    val timeZone: String,
    val validFrom: String,
    val validTo: String?,
    val days: List<ScheduleDayView>,
    val createdAt: String,
) {
    companion object {
        private val TIME = DateTimeFormatter.ofPattern("HH:mm")

        fun of(row: ScheduleRow) = ScheduleView(
            id = row.id.toString(),
            name = row.name,
            timeZone = row.timeZone,
            validFrom = row.validFrom.toString(),
            validTo = row.validTo?.toString(),
            days = row.days.map { ScheduleDayView(it.dayOfWeek, it.startTime.format(TIME), it.endTime.format(TIME), it.breakMinutes) },
            createdAt = row.createdAt.toInstant().toString(),
        )
    }
}

@Repository
class ScheduleRepository(private val dsl: DSLContext) {
    fun insert(tenantId: UUID, id: UUID, name: String, timeZone: String, validFrom: LocalDate, validTo: LocalDate?, days: List<ScheduleDay>) {
        dsl.execute(
            "insert into schedule (tenant_id, id, name, time_zone, valid_from, valid_to) " +
                "values (?, ?, ?, ?, cast(? as date), cast(? as date))",
            tenantId, id, name, timeZone, validFrom.toString(), validTo?.toString(),
        )
        for (day in days) {
            dsl.execute(
                "insert into schedule_day (tenant_id, schedule_id, day_of_week, start_time, end_time, break_minutes) " +
                    "values (?, ?, ?, cast(? as time), cast(? as time), ?)",
                tenantId, id, day.dayOfWeek, day.startTime.toString(), day.endTime.toString(), day.breakMinutes,
            )
        }
    }

    fun find(tenantId: UUID, id: UUID): ScheduleRow? =
        dsl.fetchOne("select $COLUMNS from schedule where tenant_id = ? and id = ?", tenantId, id)?.let { row(tenantId, it) }

    fun page(tenantId: UUID, after: PageKey?, limit: Int): List<ScheduleRow> {
        val rows = if (after == null) {
            dsl.fetch("select $COLUMNS from schedule where tenant_id = ? order by created_at, id limit ?", tenantId, limit)
        } else {
            dsl.fetch(
                "select $COLUMNS from schedule where tenant_id = ? and (created_at, id) > " +
                    "(cast(? as timestamptz), cast(? as uuid)) order by created_at, id limit ?",
                tenantId, after.at, after.id, limit,
            )
        }
        return rows.map { row(tenantId, it) }
    }

    private fun row(tenantId: UUID, r: Record): ScheduleRow {
        val id = r.get("id", UUID::class.java)
        val days = dsl.fetch(
            "select day_of_week, cast(start_time as text) as start_time, cast(end_time as text) as end_time, break_minutes " +
                "from schedule_day where tenant_id = ? and schedule_id = ?",
            tenantId, id,
        ).map {
            ScheduleDay(
                it.get("day_of_week", String::class.java),
                LocalTime.parse(it.get("start_time", String::class.java)),
                LocalTime.parse(it.get("end_time", String::class.java)),
                it.get("break_minutes", Number::class.java).toInt(),
            )
        }.sortedBy { WEEK.indexOf(it.dayOfWeek) }
        return ScheduleRow(
            id = id,
            name = r.get("name", String::class.java),
            timeZone = r.get("time_zone", String::class.java),
            validFrom = LocalDate.parse(r.get("valid_from", String::class.java)),
            validTo = r.get("valid_to", String::class.java)?.let(LocalDate::parse),
            createdAt = r.get("created_at", OffsetDateTime::class.java),
            days = days,
        )
    }

    private companion object {
        const val COLUMNS = "id, name, time_zone, cast(valid_from as text) as valid_from, cast(valid_to as text) as valid_to, created_at"
        val WEEK = listOf("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
    }
}

@Service
class ScheduleService(private val schedules: ScheduleRepository, private val audit: AuditLog) {
    /** Un horario no se edita: para cambiarlo se crea otro con una vigencia nueva. */
    @Transactional
    fun create(person: CurrentPerson, request: ScheduleRequest): ScheduleRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val name = checks.text("name", request.name, MAX_NAME, required = true)
        val timeZone = checks.timeZone("timeZone", request.timeZone, required = true)
        val validFrom = checks.date("validFrom", request.validFrom, required = true)
        val validTo = checks.date("validTo", request.validTo, required = false)
        if (validFrom != null && validTo != null && validTo < validFrom) {
            checks.fail("validTo", "before_start", "No puede ser anterior a validFrom.")
        }
        val days = days(checks, request.days)
        checks.done()

        val id = UUID.randomUUID()
        schedules.insert(tenantId, id, name!!, timeZone!!, validFrom!!, validTo, days)
        audit.record(tenantId, person, "schedule.created", "schedule", id)
        return schedules.find(tenantId, id)!!
    }

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, after: PageKey?, limit: Int): List<ScheduleRow> =
        schedules.page(person.requireTenant(), after, limit + 1)

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): ScheduleRow = schedules.find(person.requireTenant(), id) ?: throw Problems.notFound()

    private fun days(checks: Checks, raw: List<ScheduleDayRequest>?): List<ScheduleDay> {
        if (raw.isNullOrEmpty() || raw.size > DAYS_IN_WEEK) {
            checks.fail("days", "invalid_size", "Lleva de 1 a 7 días.")
            return emptyList()
        }
        val days = mutableListOf<ScheduleDay>()
        raw.forEachIndexed { index, item ->
            val at = "days[$index]"
            val dayOfWeek = checks.oneOf("$at.dayOfWeek", item.dayOfWeek, Checks.WEEK_DAYS, required = true)
            val start = checks.time("$at.startTime", item.startTime)
            val end = checks.time("$at.endTime", item.endTime)
            val pause = checks.whole("$at.breakMinutes", item.breakMinutes, 0, MAX_BREAK, required = true)
            if (dayOfWeek == null || dayOfWeek !in Checks.WEEK_DAYS || start == null || end == null || pause == null) return@forEachIndexed
            if (days.any { it.dayOfWeek == dayOfWeek }) {
                checks.fail("$at.dayOfWeek", "duplicate_day", "Cada día aparece una sola vez.")
                return@forEachIndexed
            }
            val day = ScheduleDay(dayOfWeek, start, end, pause)
            when {
                start == end -> checks.fail("$at.endTime", "empty_shift", "La salida no puede ser igual a la entrada.")
                pause >= day.minutes -> checks.fail("$at.breakMinutes", "break_too_long", "El descanso no cabe en el turno.")
                else -> days += day
            }
        }
        return days
    }

    private companion object {
        const val MAX_NAME = 120
        const val MAX_BREAK = 480
        const val DAYS_IN_WEEK = 7
    }
}

@RestController
@RequestMapping("/api/v1/schedules")
class ScheduleController(private val service: ScheduleService) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<ScheduleView> {
        val size = Paging.limit(limit)
        return Paging.page(service.page(person, Paging.decode(cursor), size), size, { PageKey(it.createdAt, it.id) }) { ScheduleView.of(it) }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: ScheduleRequest): ScheduleView =
        ScheduleView.of(service.create(person, request))

    @GetMapping("/{scheduleId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable scheduleId: UUID): ScheduleView =
        ScheduleView.of(service.get(person, scheduleId))
}
