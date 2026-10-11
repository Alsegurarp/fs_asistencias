package mx.fastsolution.zenit.system

import kotlin.test.Test
import kotlin.test.assertEquals

class SystemControllerTest {
    @Test
    fun `reports scaffold status`() {
        val status = SystemController().status()

        assertEquals("zenit-backend", status.service)
        assertEquals("ok", status.status)
    }
}
