package mx.fastsolution.zenit.mobile.capture

import java.time.Instant
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class BreakPolicyScheduleTest {
    private val enters = Instant.parse("2026-11-16T06:00:00Z")

    @Test
    fun `la politica cambia en el instante en que entra, tambien sin red`() {
        assertEquals("not_considered", BreakPolicySchedule.at("not_considered", "marked", enters, enters.minusSeconds(1)))
        assertEquals("marked", BreakPolicySchedule.at("not_considered", "marked", enters, enters))
        assertEquals("marked", BreakPolicySchedule.at("not_considered", "marked", enters, enters.plusSeconds(86_400)))
        assertEquals("marked", BreakPolicySchedule.at("marked", null, null, enters))
    }

    @Test
    fun `avisa mientras el cambio no entra y calla despues`() {
        assertEquals("Aviso: desde el lunes 16 de noviembre de 2026 se marcarán el inicio y el fin de la comida.",
            BreakPolicySchedule.notice("marked", "2026-11-16", enters, enters.minusSeconds(60)))
        assertEquals("Aviso: desde el lunes 16 de noviembre de 2026 ya no se marcará la comida, sólo entrada y salida.",
            BreakPolicySchedule.notice("not_considered", "2026-11-16", enters, enters.minusSeconds(60)))
        assertNull(BreakPolicySchedule.notice("marked", "2026-11-16", enters, enters))
        assertNull(BreakPolicySchedule.notice(null, null, null, enters))
    }
}
