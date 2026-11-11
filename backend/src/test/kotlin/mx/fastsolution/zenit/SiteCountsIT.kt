package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

/** Configuración (EMP-01): cada sede dice cuántas personas activas y terminales activas tiene. */
@Tag("integration")
class SiteCountsIT : CaptureTestBase() {
    private fun site(c: Company, id: String): Map<String, Any?> =
        call("GET", "/api/v1/sites?limit=100", c.adminToken).at<List<Map<String, Any?>>>("items").single { it["id"] == id }

    @Test
    fun `each site counts its active people and terminals`() {
        val c = company()
        val busy = newSite(c)
        val empty = newSite(c)
        newEmployee(c, busy)
        newEmployee(c, busy)
        newEmployee(c)
        terminal(c, busy, elsewhere())

        assertEquals(2, site(c, busy)["people"])
        assertEquals(1, site(c, busy)["terminals"])
        assertEquals(0, site(c, empty)["people"])
        assertEquals(0, site(c, empty)["terminals"])

        val one = call("GET", "/api/v1/sites/$busy", c.adminToken)
        assertEquals(2, one.at<Int>("people"))
        assertEquals(1, one.at<Int>("terminals"))
    }
}
