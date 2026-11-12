package mx.fastsolution.zenit

import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Las dos formas de marcar: el plan de la empresa, lo que admite cada sede y la forma de cada persona. */
class CaptureMethodsIT : CaptureTestBase() {
    private fun plan(c: Company, vararg methods: String, token: String = operator): Reply = call(
        "PUT", "/api/v1/tenants/${c.id}/capture-methods", token,
        json(mapOf("captureMethods" to methods.toList(), "reason" to "Cambio del plan contratado.")),
    )

    private fun method(c: Company, employeeId: String, value: String): Reply =
        call("PATCH", "/api/v1/employees/$employeeId", c.adminToken, """{"captureMethod":"$value"}""")

    private fun actions(c: Company): List<String> = call("GET", "/api/v1/audit-log?limit=200", c.adminToken).list("items[*].action")

    @Test
    fun `the plan comes with both methods and only the operator changes it`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        assertEquals(listOf("card_terminal", "phone_tag"), call("GET", "/api/v1/tenant", c.adminToken).list("captureMethods"))
        assertEquals(listOf("card_terminal", "phone_tag"), call("GET", "/api/v1/sites/$siteId", c.adminToken).list("captureMethods"))
        assertEquals("card", call("GET", "/api/v1/employees/$employeeId", c.adminToken).at("captureMethod"))

        assertEquals(403, plan(c, "card_terminal", token = c.adminToken).status)
        assertProblem(422, "validation", plan(c))
        assertProblem(422, "validation", plan(c, "card_terminal", "card_terminal"))
        assertProblem(422, "validation", plan(c, "nfc"))

        val changed = plan(c, "card_terminal")
        assertEquals(200, changed.status, changed.toString())
        assertEquals(listOf("card_terminal"), changed.list("captureMethods"))
        assertEquals(listOf("card_terminal"), call("GET", "/api/v1/sites/$siteId", c.adminToken).list("captureMethods"))
        assertTrue("tenant.capture_methods_changed" in actions(c))
        // Con el plan sólo de tarjeta, nadie pasa al teléfono y ninguna sede lo admite.
        assertProblem(422, "validation", method(c, employeeId, "phone"))
        assertProblem(422, "validation", call("PATCH", "/api/v1/sites/$siteId", c.adminToken, """{"captureMethods":["phone_tag"]}"""))
    }

    @Test
    fun `a person marks one way and switching revokes the other`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        val print = newCard(c, employeeId)
        val t = terminal(c, siteId, elsewhere())
        assertEquals("accepted", mark(t, print, Instant.now().minusSeconds(3600)).at("outcome"))

        // Al teléfono: su tarjeta queda revocada y ya no se le asigna otra.
        val toPhone = method(c, employeeId, "phone")
        assertEquals(200, toPhone.status, toPhone.toString())
        assertEquals(listOf("phone", null), listOf(toPhone.at<String>("captureMethod"), toPhone.at<String?>("activeCardId")))
        assertEquals("rejected", mark(t, print, Instant.now().minusSeconds(1800)).at("outcome"))
        val another = call("POST", "/api/v1/cards", c.adminToken, """{"label":"ZN-otra","fingerprint":"${fingerprint()}"}""")
        assertProblem(409, "employee_marks_with_phone",
            call("POST", "/api/v1/cards/${another.at<String>("id")}/assignments", c.adminToken, """{"employeeId":"$employeeId"}"""))
        // El plan no puede quitar el teléfono mientras alguien activo marca así.
        assertProblem(409, "capture_method_in_use", plan(c, "card_terminal"))

        // A la tarjeta: sus teléfonos personales quedan revocados.
        val p = activated(c, """{"mode":"personal","employeeId":"$employeeId"}""", elsewhere())
        assertEquals(200, method(c, employeeId, "card").status)
        assertEquals(listOf("revoked"), call("GET", "/api/v1/devices?limit=200", c.adminToken).list("items[?(@.id == '${p.id}')].status"))
        val log = actions(c)
        assertEquals(2, log.count { it == "employee.capture_method_changed" })
        assertTrue("card.revoked" in log && "device.revoked" in log)
    }

    @Test
    fun `a site admits less than the plan and the terminal rejects the card there`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        val print = newCard(c, employeeId)
        val t = terminal(c, siteId, elsewhere())

        // Otra sede: la persona no se puede mover a una que no admite su forma.
        val phoneOnly = newSite(c)
        val narrowed = call("PATCH", "/api/v1/sites/$phoneOnly", c.adminToken, """{"captureMethods":["phone_tag"]}""")
        assertEquals(listOf("phone_tag"), narrowed.list("captureMethods"))
        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$employeeId", c.adminToken, """{"siteId":"$phoneOnly"}"""))
        // Quien se da de alta ahí marca con su teléfono.
        val there = call(
            "POST", "/api/v1/employees", c.adminToken,
            """{"externalId":"E-tel-${fingerprint().take(6)}","displayName":"Persona tel","siteId":"$phoneOnly","employmentStart":"2026-01-05"}""",
        )
        assertEquals("phone", there.at("captureMethod"))

        // La sede de la terminal deja de admitir tarjeta: la marca se rechaza.
        assertEquals(200, call("PATCH", "/api/v1/sites/$siteId", c.adminToken, """{"captureMethods":["phone_tag"]}""").status)
        val rejected = mark(t, print, Instant.now().minusSeconds(600))
        assertEquals(listOf("rejected", "method_not_allowed"), listOf(rejected.at<String>("outcome"), rejected.at<String>("rejection.code")))

        assertProblem(422, "validation", call("PATCH", "/api/v1/sites/$siteId", c.adminToken, """{"captureMethods":["nfc"]}"""))
    }
}
