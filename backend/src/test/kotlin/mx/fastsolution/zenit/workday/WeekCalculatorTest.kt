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
    private val limits = RuleLimits(weeklyOrdinaryMaxMinutes = 2880, weeklyOvertimeMaxMinutes = 540, dailyCombinedMaxMinutes = 720,
        dailyOrdinaryMaxMinutesDay = 480, dailyOrdinaryMaxMinutesNight = 420, dailyOrdinaryMaxMinutesMixed = 450)

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
        assertEquals(Totals(750, 0, 720, 30), result.totals)
        assertEquals(1, result.version)
        assertFalse(result.hasOpenSegment)
        assertEquals(listOf("daily_ordinary_limit_exceeded", "weekly_overtime"), result.alerts.map { it.code })
    }

    @Test
    fun `a marked break is measured and its unverified computability is visible`() {
        val result = week(listOf(mark(0, "08:00"), mark(0, "12:00"), mark(0, "12:45"), mark(0, "17:00")), policy = "marked")

        assertEquals(listOf("work" to 240, "break" to 45, "work" to 255), result.segments.map { it.kind to it.minutes })
        assertEquals(Totals(495, 45, 480, 15), result.totals)
        assertTrue(result.alerts.any { it.code == "break_computability_unverified" })
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
            listOf("daily_ordinary_limit_exceeded", "daily_combined_limit_exceeded", "weekly_overtime", "weekly_overtime_limit_exceeded"),
            result.alerts.map { it.code }.distinct(),
        )
        assertEquals(6, result.alerts.count { it.code == "daily_combined_limit_exceeded" })
        // Con el tope de 2030 la misma semana tiene más tiempo extraordinario.
        assertEquals(2280, week(marks, rules = limits.copy(weeklyOrdinaryMaxMinutes = 2400, weeklyOvertimeMaxMinutes = 720)).totals.overtimeMinutes)
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

    /** La suma de los días es la semana, campo por campo. */
    private fun assertDaysAddUp(result: WeekCalculation) {
        assertEquals(
            result.totals,
            Totals(result.days.sumOf { it.workedMinutes }, result.days.sumOf { it.breakMinutes }, result.days.sumOf { it.ordinaryMinutes }, result.days.sumOf { it.overtimeMinutes }),
        )
    }

    @Test
    fun `each day carries its ordinary and overtime minutes, and the days add up to the week`() {
        val rules = limits.copy(weeklyOrdinaryMaxMinutes = 2400, dailyOvertimeMaxMinutes = 240, overtimeMaxDays = 4)
        // Lunes 9 h, martes 8 h con descanso, miércoles sin marcas, jueves 10 h, viernes entrada sin salida.
        val result = week(
            listOf(mark(0, "08:00", "clock_in"), mark(0, "17:00", "clock_out"), mark(1, "08:00", "clock_in"), mark(1, "12:00", "break_start"),
                mark(1, "12:30", "break_end"), mark(1, "16:30", "clock_out"), mark(3, "07:00", "clock_in"), mark(3, "17:00", "clock_out"), mark(4, "08:00", "clock_in")),
            policy = "marked", rules = rules,
        )

        assertEquals(
            listOf(
                DayTotals("2026-10-05", 540, 0, 480, 60),
                DayTotals("2026-10-06", 480, 30, 480, 0),
                DayTotals("2026-10-08", 600, 0, 480, 120),
                DayTotals("2026-10-09", 0, 0, 0, 0),
            ),
            result.days,
        )
        assertDaysAddUp(result)
        assertEquals(2, result.days.count { it.overtimeMinutes > 0 })
    }

    @Test
    fun `the weekly limit moves later days into overtime, and a night shift stays on the day it began`() {
        // Seis días de ocho horas con un tope semanal de 40: el sexto es todo extraordinario.
        val six = week((0..5).flatMap { listOf(mark(it, "08:00"), mark(it, "16:00")) }, rules = limits.copy(weeklyOrdinaryMaxMinutes = 2400))
        assertEquals(listOf(0, 0, 0, 0, 0, 480), six.days.map { it.overtimeMinutes })
        assertDaysAddUp(six)

        val night = week(listOf(mark(6, "20:00"), mark(6, "23:30"), mark(7, "00:00"), mark(7, "04:30")), policy = "marked")
        assertEquals(listOf(DayTotals("2026-10-11", 480, 30, 420, 60)), night.days)
        assertDaysAddUp(night)
        assertTrue(week(emptyList()).days.isEmpty())
    }

    @Test
    fun `daily overtime exists even when the week is below its limit`() {
        val result = week(listOf(mark(0, "08:00"), mark(0, "18:00")))

        assertEquals(Totals(600, 0, 480, 120), result.totals)
        assertEquals(listOf("daily_ordinary_limit_exceeded", "weekly_overtime"), result.alerts.map { it.code })
    }

    @Test
    fun `night and mixed limits apply including the three and a half hour threshold`() {
        val night = week(listOf(mark(0, "20:00"), mark(1, "04:00")))
        val mixed = week(listOf(mark(0, "15:00"), mark(0, "23:00")))
        val atThreshold = week(listOf(mark(0, "16:00"), mark(0, "23:30")))
        val belowThreshold = week(listOf(mark(0, "16:00"), mark(0, "23:29")))

        assertEquals(Totals(480, 0, 420, 60), night.totals)
        assertEquals(Totals(480, 0, 450, 30), mixed.totals)
        assertEquals(Totals(450, 0, 420, 30), atThreshold.totals)
        assertEquals(Totals(449, 0, 449, 0), belowThreshold.totals)
    }

    @Test
    fun `splitting a shift with a break across midnight preserves daily and weekly attribution`() {
        val marks = listOf(mark(6, "20:00"), mark(6, "23:30"), mark(7, "00:00"), mark(7, "04:30"))
        val result = week(marks, policy = "marked")

        assertEquals(listOf(210, 30, 270), result.segments.map { it.minutes })
        assertEquals(Totals(480, 30, 420, 60), result.totals)
        val next = WeekCalculator.calculate(marks, emptyList(), "marked", monday.plusDays(7), zone, limits)
        assertTrue(next.segments.isEmpty())
    }

    @Test
    fun `multiple shifts on the same day do not reset the ordinary limit`() {
        val result = week(listOf(mark(0, "08:00"), mark(0, "12:00"), mark(0, "14:00"), mark(0, "19:00")))

        assertEquals(Totals(540, 0, 480, 60), result.totals)
    }

    @Test
    fun `a night crossing a daylight saving change uses elapsed time in the company zone`() {
        val border = ZoneId.of("America/Tijuana")
        val start = LocalDate.parse("2026-10-31").atTime(20, 0).atZone(border).toOffsetDateTime()
        val end = LocalDate.parse("2026-11-01").atTime(6, 0).atZone(border).toOffsetDateTime()
        val result = WeekCalculator.calculate(
            listOf(RawMark(UUID.randomUUID(), start, "clock_in"), RawMark(UUID.randomUUID(), end, "clock_out")),
            emptyList(), "not_considered", LocalDate.parse("2026-10-26"), border, limits,
        )

        assertEquals(Totals(660, 0, 420, 240), result.totals)
    }

    @Test
    fun `daily and weekly overtime count each minute once and distribution violations remain visible`() {
        val rules = limits.copy(weeklyOrdinaryMaxMinutes = 2400, weeklyOvertimeMaxMinutes = 720,
            dailyOvertimeMaxMinutes = 240, overtimeMaxDays = 4, weeklyExcessOvertimeMaxMinutes = 240)
        val five = (0..4).flatMap { listOf(mark(it, "08:00"), mark(it, "18:00")) }
        assertEquals(Totals(3000, 0, 2400, 600), week(five, rules = rules).totals)
        val six = five + listOf(mark(5, "08:00"), mark(5, "18:00"))
        val result = week(six, rules = rules)

        assertEquals(Totals(3600, 0, 2400, 1200), result.totals)
        assertTrue(result.alerts.any { it.code == "daily_overtime_limit_exceeded" })
        assertTrue(result.alerts.any { it.code == "overtime_days_limit_exceeded" })
        assertTrue(result.alerts.any { it.code == "weekly_total_overtime_limit_exceeded" })
        assertEquals(1, result.alerts.count { it.code == "daily_overtime_limit_exceeded" })
    }

    @Test
    fun `a shift starting exactly at the week boundary belongs only to the new week`() {
        val marks = listOf(mark(0, "00:00", "clock_in"), mark(0, "06:00", "clock_out"))

        val previous = WeekCalculator.calculate(marks, emptyList(), "not_considered", monday.minusDays(7), zone, limits)
        assertTrue(previous.segments.isEmpty())
        assertEquals(Totals(360, 0, 360, 0), week(marks).totals)
        assertFalse(week(marks).hasOpenSegment)
    }

    @Test
    fun `a shift ending exactly at the week boundary does not open a shift in the new week`() {
        val marks = listOf(mark(6, "20:00", "clock_in"), mark(7, "00:00", "clock_out"))

        assertEquals(Totals(240, 0, 240, 0), week(marks).totals)
        val next = WeekCalculator.calculate(marks, emptyList(), "not_considered", monday.plusDays(7), zone, limits)
        assertTrue(next.segments.isEmpty())
        assertFalse(next.hasOpenSegment)
        assertEquals(Totals(0, 0, 0, 0), next.totals)
    }

    @Test
    fun `new year does not split a night shift or move its daily limit to January`() {
        val start = LocalDate.parse("2026-12-28")
        val marks = listOf(
            RawMark(UUID.randomUUID(), OffsetDateTime.parse("2026-12-31T20:00:00-06:00"), "clock_in"),
            RawMark(UUID.randomUUID(), OffsetDateTime.parse("2027-01-01T04:00:00-06:00"), "clock_out"),
        )
        val result = WeekCalculator.calculate(marks, emptyList(), "not_considered", start, zone, limits)

        assertEquals(start, WeekCalculator.weekStart(LocalDate.parse("2027-01-01"), "monday"))
        assertEquals(Totals(480, 0, 420, 60), result.totals)
        assertEquals(1, result.segments.size)
        assertTrue(result.alerts.first { it.code == "daily_ordinary_limit_exceeded" }.message.contains("2026-12-31"))
    }

    @Test
    fun `a cross year week uses the supplied rule without changing a previous result`() {
        val start = LocalDate.parse("2026-12-28")
        val marks = (0..5).flatMap { day ->
            val date = start.plusDays(day.toLong())
            listOf(
                RawMark(UUID.randomUUID(), date.atTime(8, 0).atZone(zone).toOffsetDateTime(), "clock_in"),
                RawMark(UUID.randomUUID(), date.atTime(16, 0).atZone(zone).toOffsetDateTime(), "clock_out"),
            )
        }
        val original = WeekCalculator.calculate(marks, emptyList(), "not_considered", start, zone, limits)
        val reduced = WeekCalculator.calculate(marks, emptyList(), "not_considered", start, zone,
            limits.copy(weeklyOrdinaryMaxMinutes = 2760))

        assertEquals(Totals(2880, 0, 2880, 0), original.totals)
        assertEquals(Totals(2880, 0, 2760, 120), reduced.totals)
        assertEquals(original.segments, reduced.segments)
        assertEquals(original, WeekCalculator.calculate(marks, emptyList(), "not_considered", start, zone, limits))
    }

    @Test
    fun `a night crossing the spring clock change counts elapsed hours instead of wall hours`() {
        val border = ZoneId.of("America/Tijuana")
        val start = LocalDate.parse("2026-03-07").atTime(20, 0).atZone(border).toOffsetDateTime()
        val end = LocalDate.parse("2026-03-08").atTime(6, 0).atZone(border).toOffsetDateTime()
        val result = WeekCalculator.calculate(
            listOf(RawMark(UUID.randomUUID(), start, "clock_in"), RawMark(UUID.randomUUID(), end, "clock_out")),
            emptyList(), "not_considered", LocalDate.parse("2026-03-02"), border, limits,
        )

        assertEquals(Totals(540, 0, 420, 120), result.totals)
        assertFalse(result.hasOpenSegment)
    }

    @Test
    fun `different offsets representing the same company times do not change night classification`() {
        val marks = listOf(mark(0, "16:00", "clock_in"), mark(0, "23:30", "clock_out"))
        val utc = marks.map { it.copy(at = it.at.withOffsetSameInstant(java.time.ZoneOffset.UTC)) }

        assertEquals(week(marks), week(utc))
        assertEquals(Totals(450, 0, 420, 30), week(utc).totals)
    }
}
