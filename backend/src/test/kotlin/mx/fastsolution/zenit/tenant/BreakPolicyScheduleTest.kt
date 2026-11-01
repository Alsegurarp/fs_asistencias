package mx.fastsolution.zenit.tenant

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class BreakPolicyScheduleTest {
    private fun on(date: String, weekStartsOn: String = "monday") = BreakPolicySchedule.effectiveOn(LocalDate.parse(date), weekStartsOn).toString()

    @Test
    fun `the examples of the team enter on the first monday of the quincena with seven days of notice`() {
        // El primer lunes de la quincena del 1 de noviembre queda a tres días: pasa a la del 16.
        assertEquals("2026-11-16", on("2026-10-30"))
        // El lunes 16 queda a seis días: pasa a la quincena del 1 de diciembre.
        assertEquals("2026-12-07", on("2026-11-10"))
    }

    @Test
    fun `the seven days count up to the day it enters, not up to the 1st or the 16th`() {
        // El 1 de diciembre queda a cuatro días, pero su primer lunes, el 7, a diez.
        assertEquals("2026-12-07", on("2026-11-27"))
        // Con exactamente siete días alcanza; con seis, no.
        assertEquals("2026-11-16", on("2026-11-09"))
        assertEquals("2026-12-07", on("2026-11-10"))
    }

    @Test
    fun `it follows the first day of the week of the company`() {
        // La quincena del 16 de noviembre empieza en lunes: con semana desde el domingo entra el 22.
        assertEquals("2026-11-22", on("2026-11-01", "sunday"))
        assertEquals("2026-11-16", on("2026-11-01", "monday"))
        assertEquals("2026-11-21", on("2026-11-01", "saturday"))
    }

    @Test
    fun `it crosses the end of the year and short months`() {
        assertEquals("2027-01-04", on("2026-12-20"))
        // El 16 de febrero de 2027 es martes: su primer lunes es el 22, a doce días.
        assertEquals("2027-02-22", on("2027-02-10"))
        // Del 20 de febrero el 1 de marzo, lunes, queda a nueve días.
        assertEquals("2027-03-01", on("2027-02-20"))
    }

    @Test
    fun `every date and first day of the week gives a week start inside a quincena with at least seven days of notice`() {
        var today = LocalDate.parse("2026-01-01")
        while (today.year < 2028) {
            for (day in DayOfWeek.entries) {
                val effective = BreakPolicySchedule.effectiveOn(today, day.name.lowercase())
                assertEquals(day, effective.dayOfWeek)
                val notice = ChronoUnit.DAYS.between(today, effective)
                assertTrue(notice >= BreakPolicySchedule.NOTICE_DAYS, "$today $day $effective")
                // Es el primer inicio de semana de su quincena: el anterior cae en otra quincena.
                val start = if (effective.dayOfMonth < 16) effective.withDayOfMonth(1) else effective.withDayOfMonth(16)
                assertTrue(effective.minusDays(7) < start, "$today $day $effective")
                // Y nunca se salta una quincena que sí alcanzaba.
                assertTrue(notice < 7 + 16 + 7, "$today $day $effective")
            }
            today = today.plusDays(1)
        }
    }
}
