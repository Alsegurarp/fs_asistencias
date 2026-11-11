package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/** El detalle de una tarjeta (PAD-11): quién la registró, sus asignaciones y su última lectura. */
@Tag("integration")
class CardDetailIT : CaptureTestBase() {
    private fun cardId(c: Company, print: String): String =
        call("GET", "/api/v1/cards?q=${print.take(8)}", c.adminToken).at<List<Map<String, Any?>>>("items").single()["id"] as String

    @Test
    fun `the detail tells who registered it, every holder and the last read`() {
        val c = company()
        val siteId = newSite(c)
        val first = newEmployee(c, siteId)
        val print = newCard(c, first)
        val id = cardId(c, print)

        val fresh = call("GET", "/api/v1/cards/$id", c.adminToken)
        assertEquals(200, fresh.status, fresh.toString())
        assertEquals("user", fresh.at("registeredBy.type"))
        assertNotNull(fresh.at<String?>("registeredBy.name"))
        assertEquals(1, fresh.at<Int>("assignments.length()"))
        assertNull(fresh.at<String?>("assignments[0].until"))
        assertNull(fresh.at<Any?>("lastRead"))
        assertEquals(0, fresh.at<Int>("readCount"))
        assertEquals("manual", fresh.at("technology"))

        val t = terminal(c, siteId, elsewhere())
        assertEquals(201, mark(t, print, Instant.now().minusSeconds(120)).status)
        val read = call("GET", "/api/v1/cards/$id", c.adminToken)
        assertEquals("Recepción", read.at("lastRead.deviceName"))
        assertEquals(t.id, read.at("lastRead.deviceId"))
        assertEquals(1, read.at<Int>("readCount"))

        // Perdida: la asignación queda cerrada y el historial la conserva.
        assertEquals(200, call("POST", "/api/v1/cards/$id/revocation", c.adminToken, """{"reason":"lost"}""").status)
        val lost = call("GET", "/api/v1/cards/$id", c.adminToken)
        assertEquals("lost", lost.at("status"))
        assertNull(lost.at<Any?>("assignment"))
        assertNotNull(lost.at<String?>("assignments[0].until"))
        assertEquals(first, lost.at("assignments[0].employeeId"))
    }

    @Test
    fun `only who sees cards opens the detail, and only of their company`() {
        val c = company()
        val id = cardId(c, newCard(c))
        assertEquals(200, call("GET", "/api/v1/cards/$id", member(c, "auditor").token).status)
        assertEquals(200, call("GET", "/api/v1/cards/$id", member(c, "rh").token).status)
        assertProblem(403, "forbidden", call("GET", "/api/v1/cards/$id", member(c, "supervisor").token))
        val other = company()
        assertProblem(404, "not_found", call("GET", "/api/v1/cards/$id", other.adminToken))
        assertProblem(404, "not_found", call("GET", "/api/v1/cards/${UUID.randomUUID()}", c.adminToken))
    }
}
