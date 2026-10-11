package mx.fastsolution.jornada.system

import kotlin.test.Test
import kotlin.test.assertEquals

class SystemControllerTest {
    @Test
    fun `reports scaffold status`() {
        val status = SystemController().status()

        assertEquals("control-jornada-backend", status.service)
        assertEquals("ok", status.status)
    }
}
