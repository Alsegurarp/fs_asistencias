package mx.fastsolution.zenit.workday

import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WeekCalculatorTest {
    private val zone = ZoneId.of("America/Mexico_City")
    private val monday = LocalDate.parse("2026-10-05")
    private val limits = RuleLimits(weeklyOrdinaryMaxMinutes = 2880, weeklyOvertimeMaxMinutes = 540, dailyCombinedMaxMinutes = 720)

    private fun at(day: Int, time: String): OffsetDateTime = monday.plusDays(day.toLong()).atTime(java.time.LocalTime.parse(time)).atZone(zone).toOffsetDateTime()

    private fun mark(day: Int, time: String, declared: String? = null) = RawMark(UUID.randomUUID(), at(day, time), declared)

    private fun week(marks: List<RawMark>, adjustments: List<AdjustmentRow> = emptyList(), policy: String = "not_considered", rules: RuleLimits = limits) =
        WeekCalculator.calculate(marks, adjustments, policy, monday, zone, rules)

    @Test
    fun `the week starts on the day the company chose`() {
        assertEquals(LocalDate.parse("2026-10-05"), WeekCalculator.weekStart(LocalDate.parse("2026-10-08"), "monday"))
        assertEquals(LocalDate.parse("2026-10-05"), WeekCalculator.weekStart(LocalDate.parse("2026-10-05"), "monday"))
        assertEquals(LocalDate.parse("2026-10-04"), WeekCalculator.weekStart(LocalDate.parse("2026-10-08"), "sunday"))
    }

    @Test
    fun `entries and exits pair into work segments and add up`() {
        val result = week(listOf(mark(0, "08:00"), mark(0, "16:30"), mark(1, "08:00"), mark(1, "12:00")))

        assertEquals(listOf(510, 240), result.segments.map { it.minutes })
        assertEquals(listOf("work", "work"), result.segments.map { it.kind })
        assertEquals(Totals(750, 0, 750, 0), result.totals)
        assertEquals(1, result.version)
        assertFalse(result.hasOpenSegment)
        assertTrue(result.alerts.isEmpty())
    }

    @Test
    fun `a marked break is measured and never counts as work`() {
        val result = week(listOf(mark(0, "08:00"), mark(0, "12:00"), mark(0, "12:45"), mark(0, "17:00")), policy = "marked")

        assertEquals(listOf("work" to 240, "break" to 45, "work" to 255), result.segments.map { it.kind to it.minutes })
        assertEquals(Totals(495, 45, 495, 0), result.totals)
        // El descanso termina con el mismo marcaje con el que se reanuda el trabajo.
        assertEquals(result.segments[1].endEventId, result.segments[2].startEventId)
    }

    @Test
    fun `time over the weekly limit is overtime and the limits raise alerts`() {
        // Seis días de trece horas: 4680 minutos.
        val marks = (0..5).flatMap { listOf(mark(it, "07:00"), mark(it, "20:00")) }

        val result = week(marks)

        assertEquals(Totals(4680, 0, 2880, 1800), result.totals)
        assertEquals(
            listOf("daily_combined_limit_exceeded", "weekly_overtime", "weekly_overtime_limit_exceeded"),
            result.alerts.map { it.code }.distinct(),
        )
        assertEquals(6, result.alerts.count { it.code == "daily_combined_limit_exceeded" })
        // Con el tope de 2030 la misma semana tiene más tiempo extraordinario.
        assertEquals(2280, week(marks, rules = RuleLimits(2400, 720, 720)).totals.overtimeMinutes)
    }

    @Test
    fun `a segment without its closing mark stays open and does not add up`() {
        val result = week(listOf(mark(0, "08:00"), mark(0, "16:00"), mark(1, "08:00")))

        assertEquals(listOf(480, 0), result.segments.map { it.minutes })
        assertNull(result.segments[1].endAt)
        assertNull(result.segments[1].endEventId)
        assertTrue(result.hasOpenSegment)
        assertEquals(listOf("open_segment"), result.alerts.map { it.code })
        assertEquals(480, result.totals.workedMinutes)
    }

    @Test
    fun `an adjustment adds, excludes or retypes a mark without touching it and raises the version`() {
        val entry = mark(1, "09:00")
        val open = listOf(mark(0, "08:00"), mark(0, "16:00"), entry)

        val added = week(open, listOf(AdjustmentRow(UUID.randomUUID(), "add_event", null, "clock_out", at(1, "15:00"))))
        assertEquals(listOf(480, 360), added.segments.map { it.minutes })
        assertEquals(listOf(2, 2), added.segments.map { it.version })
        assertFalse(added.hasOpenSegment)

        val excluded = week(open, listOf(AdjustmentRow(UUID.randomUUID(), "exclude_event", entry.id, null, null)))
        assertEquals(listOf(480), excluded.segments.map { it.minutes })

        // La segunda marca del lunes no era una salida: la persona volvía a entrar.
        // La del martes llega más de dieciséis horas después y abre otra jornada.
        val second = open[1]
        val retyped = week(open, listOf(AdjustmentRow(UUID.randomUUID(), "retype_event", second.id, "clock_in", null)))
        assertEquals(listOf(0, 0, 0), retyped.segments.map { it.minutes })
        assertTrue(retyped.hasOpenSegment)
        // Lo guardado no cambió: el mismo cálculo sin ajustes da lo de antes.
        assertEquals(listOf(480, 0), week(open).segments.map { it.minutes })
    }

    @Test
    fun `a repeated reading is ignored and the order of arrival does not matter`() {
        val marks = listOf(mark(0, "08:00"), mark(0, "08:00:30"), mark(0, "16:00"), mark(0, "16:00:20"))

        val inOrder = week(marks)
        val shuffled = week(marks.reversed())

        assertEquals(listOf(480), inOrder.segments.map { it.minutes })
        assertEquals(inOrder.segments, shuffled.segments)
        assertEquals(inOrder.totals, shuffled.totals)
    }

    @Test
    fun `a shift belongs to the week where it starts`() {
        // Empieza el domingo anterior por la noche y termina el lunes: es de la semana anterior.
        val before = listOf(mark(-1, "22:00"), mark(0, "06:00"))
        // Empieza el domingo de esta semana y termina el lunes siguiente: es de ésta.
        val after = listOf(mark(6, "22:00"), mark(7, "06:00"))

        assertTrue(week(before).segments.isEmpty())
        assertEquals(listOf(480), week(after).segments.map { it.minutes })
        // La marca abierta de la semana anterior no abre nada en ésta.
        assertEquals(listOf(480), week(before + listOf(mark(0, "08:00"), mark(0, "16:00"))).segments.map { it.minutes })
    }

    @Test
    fun `the same marks always give the same segment identifiers`() {
        val marks = listOf(mark(0, "08:00"), mark(0, "16:00"))

        assertEquals(week(marks).segments.map { it.id }, week(marks).segments.map { it.id })
    }
}
