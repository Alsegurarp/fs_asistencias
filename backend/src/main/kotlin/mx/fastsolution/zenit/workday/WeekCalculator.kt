package mx.fastsolution.zenit.workday

import mx.fastsolution.zenit.capture.LastMark
import mx.fastsolution.zenit.capture.MarkRules
import java.time.DayOfWeek
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters
import java.util.UUID

/** Marcaje tal como se guardó: lo que la persona declaró y cuándo. */
data class RawMark(val id: UUID, val at: OffsetDateTime, val declaredType: String?)

/** Corrección ya aprobada: agrega, quita o cambia el tipo de un marcaje sin tocarlo. */
data class AdjustmentRow(val id: UUID, val kind: String, val eventId: UUID?, val eventType: String?, val occurredAt: OffsetDateTime?)

data class Segment(
    val id: String,
    val kind: String,
    val startAt: String,
    val endAt: String?,
    val minutes: Int,
    val startEventId: String,
    val endEventId: String?,
    val version: Int,
)

data class Totals(val workedMinutes: Int, val breakMinutes: Int, val ordinaryMinutes: Int, val overtimeMinutes: Int)

data class Alert(val code: String, val severity: String, val message: String)

data class RuleLimits(val weeklyOrdinaryMaxMinutes: Int, val weeklyOvertimeMaxMinutes: Int?, val dailyCombinedMaxMinutes: Int?)

data class WeekCalculation(val segments: List<Segment>, val totals: Totals, val alerts: List<Alert>, val version: Int, val hasOpenSegment: Boolean)

/**
 * Calcula la jornada de una semana a partir de los marcajes. No guarda nada y
 * no toca la evidencia: con los mismos marcajes, ajustes y reglas da siempre
 * el mismo resultado.
 */
object WeekCalculator {
    private const val SHIFT_GAP_HOURS = 16L
    private const val DUPLICATE_SECONDS = 60L

    /** Inicio de la semana de la empresa que contiene esa fecha. */
    fun weekStart(date: LocalDate, weekStartsOn: String): LocalDate =
        date.with(TemporalAdjusters.previousOrSame(DayOfWeek.valueOf(weekStartsOn.uppercase())))

    fun calculate(
        marks: List<RawMark>,
        adjustments: List<AdjustmentRow>,
        breakPolicy: String,
        weekStart: LocalDate,
        zone: ZoneId,
        limits: RuleLimits,
        duplicateWindow: Duration = Duration.ofSeconds(DUPLICATE_SECONDS),
        shiftGap: Duration = Duration.ofHours(SHIFT_GAP_HOURS),
    ): WeekCalculation {
        val version = 1 + adjustments.size
        val from = weekStart.atStartOfDay(zone).toOffsetDateTime()
        val until = weekStart.plusDays(7).atStartOfDay(zone).toOffsetDateTime()

        // El tipo se vuelve a deducir en orden de hora: una marca que llegó tarde
        // ya no deja incoherentes a las que se recibieron antes.
        val segments = mutableListOf<Segment>()
        var open: Triple<String, OffsetDateTime, UUID>? = null
        fun emit(end: Pair<OffsetDateTime, UUID>?) {
            val (kind, startAt, startId) = open ?: return
            if (startAt >= from && startAt < until) {
                segments += Segment(
                    id = UUID.nameUUIDFromBytes("$startId|$kind".toByteArray()).toString(),
                    kind = kind,
                    startAt = startAt.toInstant().toString(),
                    endAt = end?.first?.toInstant()?.toString(),
                    minutes = end?.let { Duration.between(startAt, it.first).toMinutes().toInt() } ?: 0,
                    startEventId = startId.toString(),
                    endEventId = end?.second?.toString(),
                    version = version,
                )
            }
            open = null
        }
        for ((id, at, type) in effective(marks, adjustments, breakPolicy, duplicateWindow, shiftGap)) {
            when (type) {
                "clock_in" -> {
                    emit(null)
                    open = Triple("work", at, id)
                }
                "break_start" -> {
                    emit(if (open?.first == "work") at to id else null)
                    open = Triple("break", at, id)
                }
                "break_end" -> if (open?.first == "break") {
                    emit(at to id)
                    open = Triple("work", at, id)
                } else if (open == null) {
                    open = Triple("work", at, id)
                }
                else -> emit(at to id)
            }
        }
        emit(null)

        val worked = segments.filter { it.kind == "work" }.sumOf { it.minutes }
        val paused = segments.filter { it.kind == "break" }.sumOf { it.minutes }
        val overtime = (worked - limits.weeklyOrdinaryMaxMinutes).coerceAtLeast(0)
        val hasOpen = segments.any { it.endAt == null }
        val alerts = mutableListOf<Alert>()
        if (hasOpen) alerts += Alert("open_segment", "warning", "Falta el marcaje que cierra un tramo; ese tramo no suma.")
        val perDay = segments.filter { it.kind == "work" }
            .groupBy { OffsetDateTime.parse(it.startAt).atZoneSameInstant(zone).toLocalDate() }
            .mapValues { day -> day.value.sumOf { it.minutes } }
        limits.dailyCombinedMaxMinutes?.let { max ->
            perDay.filter { it.value > max }.keys.sorted().forEach {
                alerts += Alert("daily_combined_limit_exceeded", "critical", "El $it suma más de ${max / 60} horas entre jornada ordinaria y extraordinaria.")
            }
        }
        if (overtime > 0) alerts += Alert("weekly_overtime", "info", "La semana tiene $overtime minutos sobre la jornada ordinaria.")
        limits.weeklyOvertimeMaxMinutes?.let { max ->
            if (overtime > max) alerts += Alert("weekly_overtime_limit_exceeded", "critical", "El tiempo extraordinario excede las ${max / 60} horas semanales.")
        }
        return WeekCalculation(
            // Por instante y no por texto: una fracción de segundo cambia el orden alfabético.
            segments.sortedBy { Instant.parse(it.startAt) },
            Totals(worked, paused, worked - overtime, overtime),
            alerts,
            version,
            hasOpen,
        )
    }

    /** Marcajes en orden, con los ajustes aplicados, el tipo que les toca y sin lecturas repetidas. */
    private fun effective(
        marks: List<RawMark>,
        adjustments: List<AdjustmentRow>,
        breakPolicy: String,
        duplicateWindow: Duration,
        shiftGap: Duration,
    ): List<Triple<UUID, OffsetDateTime, String>> {
        val excluded = adjustments.filter { it.kind == "exclude_event" }.mapNotNull { it.eventId }.toSet()
        val forced = adjustments.filter { it.kind == "retype_event" && it.eventId != null && it.eventType != null }
            .associate { it.eventId!! to it.eventType!! }.toMutableMap()
        val all = marks.filter { it.id !in excluded }.toMutableList()
        adjustments.filter { it.kind == "add_event" && it.occurredAt != null && it.eventType != null }.forEach {
            all += RawMark(it.id, it.occurredAt!!, null)
            forced[it.id] = it.eventType!!
        }
        val result = mutableListOf<Triple<UUID, OffsetDateTime, String>>()
        var last: LastMark? = null
        for (mark in all.sortedBy { it.at }) {
            val fixed = forced[mark.id]
            val type = if (fixed != null) {
                fixed
            } else {
                val decision = MarkRules.decide(
                    breakPolicy, last, mark.declaredType, mark.at, duplicateWindow, shiftGap,
                )
                // Una lectura repetida no abre ni cierra nada.
                if ("duplicate" in decision.incidents) continue
                decision.type
            }
            result += Triple(mark.id, mark.at, type)
            last = LastMark(type, mark.at)
        }
        return result
    }
}
