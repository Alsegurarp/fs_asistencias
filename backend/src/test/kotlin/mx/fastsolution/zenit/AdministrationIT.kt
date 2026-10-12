package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/** Suspender y reactivar una empresa, y soltar la liga de una cuenta perdida. */
@Tag("integration")
class AdministrationIT : WorkdayTestBase() {
    private fun suspend(id: String, token: String? = operator, body: String = """{"reason":"Falta de pago del periodo."}"""): Reply =
        call("POST", "/api/v1/tenants/$id/suspension", token, body)

    private fun reactivate(id: String, token: String? = operator, body: String = """{"reason":"Pago recibido; se restablece."}"""): Reply =
        call("POST", "/api/v1/tenants/$id/reactivation", token, body)

    @Test
    fun `the operator suspends a company for its people and its devices, and reactivating gives everything back`() {
        val c = company()
        val other = company()
        val rh = member(c, "rh")
        val employeeId = newEmployee(c)
        val card = newCard(c, employeeId)
        val phone = phone(c, employeeId)
        val pendingCode = enroll(c, """{"mode":"personal","employeeId":"${newEmployee(c)}"}""").at<String>("code")
        assertEquals(201, mark(phone, card, Instant.now().minusSeconds(600)).status)

        // Sólo quien opera el servicio, con un motivo, y sobre una empresa que existe.
        assertProblem(401, "unauthorized", suspend(c.id, token = null))
        assertProblem(401, "unauthorized", reactivate(c.id, token = null))
        assertProblem(403, "forbidden", suspend(c.id, token = c.adminToken))
        assertProblem(403, "forbidden", suspend(other.id, token = c.adminToken))
        assertProblem(403, "forbidden", reactivate(c.id, token = rh.token))
        for (bad in listOf("{}", """{"reason":""}""", """{"reason":"corto"}""", """{"reason":"Un motivo válido.","tenantId":"${other.id}"}""")) {
            assertProblem(422, "validation", suspend(c.id, body = bad))
            assertProblem(422, "validation", reactivate(c.id, body = bad))
        }
        assertProblem(404, "not_found", suspend(UUID.randomUUID().toString()))
        assertProblem(404, "not_found", suspend("no-es-un-identificador"))
        assertProblem(404, "not_found", reactivate(UUID.randomUUID().toString()))
        // Nada de lo anterior la cambió, y una empresa activa no se reactiva.
        assertProblem(409, "tenant_not_suspended", reactivate(c.id))
        assertEquals(200, call("GET", "/api/v1/tenant", c.adminToken).status)

        val suspended = suspend(c.id)
        assertEquals(200, suspended.status, suspended.toString())
        assertEquals(listOf(c.id, "suspended"), listOf<String>(suspended.at("id"), suspended.at("status")))
        assertProblem(409, "tenant_not_active", suspend(c.id))
        // Cerrada para su gente...
        assertProblem(403, "forbidden", call("GET", "/api/v1/tenant", c.adminToken))
        assertProblem(403, "forbidden", call("GET", "/api/v1/employees", rh.token))
        assertEquals(emptyList(), call("GET", "/api/v1/me", c.adminToken).list("roles"))
        // ...para sus dispositivos...
        assertProblem(401, "unauthorized", mark(phone, card, Instant.now().minusSeconds(300)))
        // ...y para los códigos que quedaron sin canjear.
        val key = newKey()
        assertProblem(410, "enrollment_gone", activation(pendingCode, key))
        // La otra empresa no se entera.
        assertEquals(200, call("GET", "/api/v1/tenant", other.adminToken).status)
        assertEquals(1, count("select count(*) from tenant where id = ? and status = 'suspended'", UUID.fromString(c.id)))
        assertEquals(1, count("select count(*) from tenant where id = ? and status = 'active'", UUID.fromString(other.id)))

        val active = reactivate(c.id)
        assertEquals(200, active.status, active.toString())
        assertEquals("active", active.at("status"))
        // Todo sigue como estaba: personas, roles, dispositivo y el código pendiente.
        assertEquals(200, call("GET", "/api/v1/tenant", c.adminToken).status)
        assertEquals(listOf("rh"), call("GET", "/api/v1/me", rh.token).list("roles"))
        assertEquals(201, mark(phone, card, Instant.now().minusSeconds(120)).status)
        assertEquals(201, activation(pendingCode, key).status)
        // El marcaje rechazado durante la suspensión no se guardó.
        assertEquals(2, count("select count(*) from attendance_event where tenant_id = ?", UUID.fromString(c.id)))

        // Queda en la bitácora de la empresa, con el motivo, y no en la de la otra.
        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        for (action in listOf("tenant.suspended", "tenant.reactivated")) {
            assertEquals(1, audit.at<List<Any>>("items[?(@.action=='$action')]").size, action)
        }
        assertEquals(listOf("Falta de pago del periodo."), audit.at<List<String>>("items[?(@.action=='tenant.suspended')].metadata.reason"))
        assertEquals(listOf("user"), audit.at<List<String>>("items[?(@.action=='tenant.suspended')].actor.type"))
        assertFalse("tenant.suspended" in call("GET", "/api/v1/audit-log?limit=200", other.adminToken).body)
    }

    @Test
    fun `unlinking lets a person come back with a new account, keeps their roles and does not take access away`() {
        val c = company()
        val other = company()
        val address = email("rh")
        val invited = call("POST", "/api/v1/users", c.adminToken, """{"email":"$address","roles":["rh","supervisor"]}""")
        assertEquals(201, invited.status, invited.toString())
        val id = invited.at<String>("id")
        fun unlink(userId: String, token: String? = c.adminToken) = call("POST", "/api/v1/users/$userId/unlink", token)
        fun roles(token: String) = call("GET", "/api/v1/me", token).list("roles")

        // Una invitación que nadie ha tomado no tiene liga que soltar.
        assertProblem(409, "user_not_linked", unlink(id))
        val oldAccount = token(subject(), address)
        assertEquals(listOf("rh", "supervisor"), roles(oldAccount))
        // La persona perdió su cuenta y tiene otra con el mismo correo: mientras la liga exista, la nueva no entra.
        val newAccount = token(subject(), address)
        assertEquals(emptyList(), roles(newAccount))
        assertProblem(403, "forbidden", call("GET", "/api/v1/employees", newAccount))

        // Sólo quien administra esa empresa.
        assertProblem(401, "unauthorized", unlink(id, token = null))
        assertProblem(403, "forbidden", unlink(id, token = oldAccount))
        assertProblem(403, "forbidden", unlink(id, token = member(c, "auditor").token))
        assertProblem(404, "not_found", unlink(id, token = other.adminToken))
        assertProblem(404, "not_found", unlink(UUID.randomUUID().toString()))
        assertProblem(404, "not_found", unlink("no-es-un-identificador"))
        assertEquals("active", call("GET", "/api/v1/users/$id", c.adminToken).at("status"))

        val unlinked = unlink(id)
        assertEquals(200, unlinked.status, unlinked.toString())
        assertEquals(listOf(id, "invited"), listOf<String>(unlinked.at("id"), unlinked.at("status")))
        assertNull(unlinked.at<Any?>("linkedAt"))
        assertEquals(listOf("rh", "supervisor"), unlinked.list("roles"))
        assertProblem(409, "user_not_linked", unlink(id))
        // La cuenta nueva entra y queda ligada, con los mismos roles.
        assertEquals(listOf("rh", "supervisor"), roles(newAccount))
        assertEquals(200, call("GET", "/api/v1/employees", newAccount).status)
        val relinked = call("GET", "/api/v1/users/$id", c.adminToken)
        assertEquals("active", relinked.at("status"))
        assertNotNull(relinked.at<Any?>("linkedAt"))
        // La cuenta anterior ya no es la de esa persona.
        assertEquals(emptyList(), roles(oldAccount))
        assertProblem(403, "forbidden", call("GET", "/api/v1/employees", oldAccount))

        // Soltar la liga no devuelve el acceso a quien se le quitó.
        assertEquals("disabled", call("PATCH", "/api/v1/users/$id", c.adminToken, """{"disabled":true}""").at("status"))
        val stillDisabled = unlink(id)
        assertEquals("disabled", stillDisabled.at("status"))
        assertNull(stillDisabled.at<Any?>("linkedAt"))
        val thirdAccount = token(subject(), address)
        assertEquals(emptyList(), roles(thirdAccount))
        assertEquals(emptyList(), roles(newAccount))
        // Al devolvérselo queda invitada, y entra con la cuenta que tenga.
        assertEquals("invited", call("PATCH", "/api/v1/users/$id", c.adminToken, """{"disabled":false}""").at("status"))
        assertEquals(listOf("rh", "supervisor"), roles(thirdAccount))

        // Quien administra puede soltar su propia liga sin dejar a la empresa sin nadie: vuelve a ligarse al entrar.
        assertEquals("invited", unlink(c.adminId).at("status"))
        assertEquals(200, call("GET", "/api/v1/tenant", c.adminToken).status)
        assertEquals("active", call("GET", "/api/v1/users/${c.adminId}", c.adminToken).at("status"))

        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(3, audit.at<List<Any>>("items[?(@.action=='user.unlinked')]").size)
        assertEquals(setOf(id, c.adminId), audit.at<List<String>>("items[?(@.action=='user.unlinked')].target.id").toSet())
        assertFalse("user.unlinked" in call("GET", "/api/v1/audit-log?limit=200", other.adminToken).body)
    }

    @Test
    fun `the operator unlinks an administrator who lost their account, only an administrator, with a reason and a trace`() {
        val c = company()
        val other = company()
        val rh = member(c, "rh")
        val tenant = UUID.fromString(c.id)
        fun unlink(tenantId: String, email: String, token: String? = operator, reason: String? = "Perdió su cuenta y es la única que administra.") =
            call("POST", "/api/v1/tenants/$tenantId/administrators/unlink", token, json(mapOf("email" to email, "reason" to reason)))
        fun roles(token: String) = call("GET", "/api/v1/me", token).list("roles")
        fun linked() = count("select count(*) from tenant_user where tenant_id = ? and subject is not null", tenant)

        // La única administradora perdió su cuenta y volvió con otra del mismo correo: la nueva no entra.
        val newAccount = token(subject(), c.adminEmail)
        assertEquals(emptyList(), roles(newAccount))

        // Sólo quien opera el servicio. Ni quien administra la empresa puede usar esta ruta.
        assertProblem(401, "unauthorized", unlink(c.id, c.adminEmail, token = null))
        assertProblem(403, "forbidden", unlink(c.id, c.adminEmail, token = c.adminToken))
        assertProblem(403, "forbidden", unlink(c.id, c.adminEmail, token = rh.token))
        // Con correo y motivo válidos, y sin campos de más.
        val path = "/api/v1/tenants/${c.id}/administrators/unlink"
        for (bad in listOf(
            "{}", """{"email":"${c.adminEmail}"}""", """{"reason":"Un motivo suficiente."}""",
            """{"email":"${c.adminEmail}","reason":"corto"}""", """{"email":"sin-arroba","reason":"Un motivo suficiente."}""",
            """{"email":"${c.adminEmail}","reason":"Un motivo suficiente.","userId":"${c.adminId}"}""",
        )) {
            assertProblem(422, "validation", call("POST", path, operator, bad))
        }
        // Sólo sobre quien administra esa empresa: lo demás no existe para esta operación, y la respuesta no dice por qué.
        assertProblem(404, "not_found", unlink(UUID.randomUUID().toString(), c.adminEmail))
        assertProblem(404, "not_found", unlink("no-es-un-identificador", c.adminEmail))
        assertProblem(404, "not_found", unlink(c.id, rh.email))
        assertProblem(404, "not_found", unlink(c.id, other.adminEmail))
        assertProblem(404, "not_found", unlink(other.id, c.adminEmail))
        assertProblem(404, "not_found", unlink(c.id, email("nadie")))
        // Nada de lo anterior soltó una liga.
        assertEquals(2, linked())
        assertEquals(200, call("GET", "/api/v1/tenant", c.adminToken).status)

        val done = unlink(c.id, c.adminEmail.uppercase())
        assertEquals(204, done.status, done.toString())
        // No devuelve nada de la persona.
        assertEquals("", done.body)
        assertEquals(1, linked())
        assertProblem(409, "user_not_linked", unlink(c.id, c.adminEmail))
        // La cuenta nueva entra con los mismos roles; la anterior ya no es la de esa persona.
        assertEquals(listOf("admin_empresa"), roles(newAccount))
        assertEquals(200, call("GET", "/api/v1/users", newAccount).status)
        assertEquals(emptyList(), roles(c.adminToken))
        // A quien administra la otra empresa no le pasó nada.
        assertEquals(listOf("admin_empresa"), roles(other.adminToken))

        // Queda en la bitácora de la empresa: quién, por qué, y que fue desde la operación del servicio.
        val audit = call("GET", "/api/v1/audit-log?limit=200", newAccount)
        val entries = audit.at<List<Map<String, Any?>>>("items[?(@.action=='user.unlinked')]")
        assertEquals(1, entries.size)
        assertEquals(mapOf("by" to "operator", "reason" to "Perdió su cuenta y es la única que administra."), entries.single()["metadata"])
        assertEquals(c.adminId, (entries.single()["target"] as Map<*, *>)["id"])
        assertFalse("user.unlinked" in call("GET", "/api/v1/audit-log?limit=200", other.adminToken).body)

        // Una empresa suspendida también puede necesitarlo: no depende de su estado.
        assertEquals(200, suspend(other.id).status)
        assertEquals(204, unlink(other.id, other.adminEmail).status)
        assertEquals(200, reactivate(other.id).status)
        assertEquals(listOf("admin_empresa"), roles(other.adminToken))
    }
}
