package mx.fastsolution.zenit.mobile.capture

import java.time.Instant
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
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

    @Test
    fun `actualiza la politica y el aviso al vencer sin otra operacion`() = runBlocking {
        val deadline = Instant.now().plusSeconds(1)
        val states = withTimeout(5_000) {
            BreakPolicySchedule.updates(deadline).map {
                val now = Instant.now()
                BreakPolicySchedule.at("not_considered", "marked", deadline, now) to
                    BreakPolicySchedule.notice("marked", "2026-11-16", deadline, now)
            }.toList()
        }
        assertEquals(2, states.size)
        assertEquals("not_considered", states.first().first)
        assertNotNull(states.first().second)
        assertEquals("marked", states.last().first)
        assertNull(states.last().second)
    }

    @Test
    fun `sin cambio futuro emite una vez y no mantiene un reloj activo`() = runBlocking {
        assertEquals(1, BreakPolicySchedule.updates(null).toList().size)
        assertEquals(1, BreakPolicySchedule.updates(Instant.now().minusSeconds(1)).toList().size)
    }

    @Test
    fun `cancelar la pantalla termina la espera futura sin emitir otra actualizacion`() = runBlocking {
        var updates = 0
        val waiting = launch(start = CoroutineStart.UNDISPATCHED) {
            BreakPolicySchedule.updates(Instant.now().plusSeconds(86_400)).collect { updates++ }
        }
        assertEquals(1, updates)
        assertTrue(waiting.isActive)
        withTimeout(1_000) { waiting.cancelAndJoin() }
        assertTrue(waiting.isCancelled)
        assertEquals(1, updates)
    }
}
