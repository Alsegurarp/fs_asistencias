package mx.fastsolution.zenit.mobile.capture

import java.time.Instant
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class SessionPolicyTest {
    private val start = Instant.parse("2026-10-12T12:00:00Z")

    @Test
    fun `acepta ultimo consecutivo y rechaza limite de edad o numero`() {
        assertTrue(SessionPolicy.usable(start, start.plusSeconds(72 * 3600 - 1), 72, 1000, 1000))
        assertFalse(SessionPolicy.usable(start, start.plusSeconds(72 * 3600), 72, 1, 1000))
        assertFalse(SessionPolicy.usable(start, start, 72, 1001, 1000))
        assertFalse(SessionPolicy.usable(start, start, 72, 0, 1000))
    }

    @Test
    fun `un reloj anterior no prolonga una sesion fuera de la tolerancia`() {
        assertTrue(SessionPolicy.usable(start, start.minusSeconds(60), 72, 1, 1000))
        assertFalse(SessionPolicy.usable(start, start.minusSeconds(61), 72, 1, 1000))
    }
}
