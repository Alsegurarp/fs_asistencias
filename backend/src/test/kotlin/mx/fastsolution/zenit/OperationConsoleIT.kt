package mx.fastsolution.zenit

import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Tag
import java.net.URLEncoder
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** La consola de quien opera el servicio: empresas, quién las administra y el uso del mes de todas. */
@Tag("integration")
class OperationConsoleIT : WorkdayTestBase() {
    private val tokyo = ZoneId.of("Asia/Tokyo")

    private fun marker() = UUID.randomUUID().toString().take(8)

    private fun q(text: String) = URLEncoder.encode(text, Charsets.UTF_8)

    /** Empresa con nombre y zona propios; su primera administración queda invitada y, si `linked`, ya entró. */
    private fun named(name: String, timeZone: String = "America/Mexico_City", linked: Boolean = true): Company {
        val slug = "consola-${marker()}"
        val adminEmail = email("admin")
        val created = call(
            "POST", "/api/v1/tenants", operator,
            json(
                mapOf(
                    "name" to name, "slug" to slug, "timeZone" to timeZone, "weekStartsOn" to "monday",
                    "breakPolicy" to "not_considered", "firstAdminEmail" to adminEmail,
                ),
            ),
        )
        assertEquals(201, created.status, created.toString())
        val adminToken = token(subject(), adminEmail)
        if (!linked) return Company(created.at("id"), adminEmail, adminToken, "")
        val me = call("GET", "/api/v1/me", adminToken)
        assertEquals(200, me.status, me.toString())
        return Company(created.at("id"), adminEmail, adminToken, me.at("userId"))
    }

    private fun suspend(id: String) =
        assertEquals(200, call("POST", "/api/v1/tenants/$id/suspension", operator, """{"reason":"Falta de pago del periodo."}""").status)

    private fun item(page: Reply, id: String): Map<String, Any?> = page.at<List<Map<String, Any?>>>("items[?(@.id=='$id')]").single()

    @Suppress("UNCHECKED_CAST")
    private fun administration(page: Reply, id: String) = item(page, id)["administration"] as Map<String, Any?>

    @Test
    fun `the console finds companies by text, status and administration, with who administers each and the tab counts`() {
        val tag = marker()
        val linked = named("Panadería Güera $tag")
        val pending = named("Tortillería del Centro $tag", linked = false)
        val nobody = named("Abarrotes Norte $tag")
        change("update tenant_user set status = 'disabled' where tenant_id = ?", UUID.fromString(nobody.id))
        suspend(pending.id)
        // Seis personas más con Administración, invitadas por quien ya la administra.
        repeat(6) { n ->
            val invited = call("POST", "/api/v1/users", linked.adminToken, """{"email":"${email("admin$n")}","roles":["admin_empresa"]}""")
            assertEquals(201, invited.status, invited.toString())
        }

        val scheduled = call(
            "POST", "/api/v1/tenants/${linked.id}/break-policy-changes", operator,
            """{"breakPolicy":"marked","reason":"Cambio pedido por la empresa"}""",
        )
        assertEquals(201, scheduled.status, scheduled.toString())
        // Desde 0.37.0 el cambio dice quién lo programó.
        assertFalse(scheduled.at<String?>("scheduledByName").isNullOrBlank(), scheduled.toString())

        val all = call("GET", "/api/v1/tenants?limit=200&q=${q(tag)}", operator)
        assertEquals(200, all.status, all.toString())
        // De la más antigua a la más reciente, y sólo las que llevan el texto.
        assertEquals(listOf(linked.id, pending.id, nobody.id), all.list("items[*].id"))
        // La política y su cambio programado, leídos en lote, son los mismos que ve la empresa.
        val own = call("GET", "/api/v1/tenant", linked.adminToken)
        assertEquals(own.at<Map<String, Any?>>("breakPolicyChange"), item(all, linked.id)["breakPolicyChange"])
        assertEquals(listOf("not_considered", null), listOf(item(all, linked.id)["breakPolicy"], item(all, pending.id)["breakPolicyChange"]))
        // La suspensión vigente dice cuándo, quién y por qué; una activa no trae suspensión.
        @Suppress("UNCHECKED_CAST")
        val suspension = item(all, pending.id)["suspension"] as Map<String, Any?>
        assertEquals("Falta de pago del periodo.", suspension["reason"])
        assertFalse((suspension["byName"] as String?).isNullOrBlank())
        assertNull(item(all, linked.id)["suspension"])

        val first = administration(all, linked.id)
        assertEquals("linked", first["state"])
        assertEquals(7, first["total"])
        @Suppress("UNCHECKED_CAST")
        val people = first["administrators"] as List<Map<String, Any?>>
        // Hasta cinco, primero quien ya entró.
        assertEquals(5, people.size)
        assertEquals(listOf(linked.adminEmail, "active"), listOf(people[0]["email"], people[0]["status"]))
        assertNotNull(people[0]["linkedAt"])
        assertTrue(people.drop(1).all { it["status"] == "invited" && it["linkedAt"] == null }, people.toString())

        val second = administration(all, pending.id)
        assertEquals(listOf("pending", 1), listOf(second["state"], second["total"]))
        @Suppress("UNCHECKED_CAST")
        val invitedOnly = second["administrators"] as List<Map<String, Any?>>
        assertEquals(listOf(mapOf("email" to pending.adminEmail, "status" to "invited", "linkedAt" to null)), invitedOnly.map { it - "invitedAt" })
        // Quien perdió el acceso no administra: no aparece ni se cuenta.
        assertEquals(mapOf("state" to "none", "total" to 0, "administrators" to emptyList<Any>()), administration(all, nobody.id))

        // Sin acentos ni mayúsculas, por fragmento del nombre o del identificador.
        assertEquals(listOf(linked.id), call("GET", "/api/v1/tenants?q=${q("GUERA $tag")}", operator).list("items[*].id"))
        val slug = item(all, nobody.id)["slug"] as String
        assertEquals(listOf(nobody.id), call("GET", "/api/v1/tenants?q=${q(slug)}", operator).list("items[*].id"))
        // Los filtros se aplican antes de paginar.
        assertEquals(listOf(pending.id), call("GET", "/api/v1/tenants?q=${q(tag)}&status=suspended", operator).list("items[*].id"))
        assertEquals(listOf(linked.id, nobody.id), call("GET", "/api/v1/tenants?q=${q(tag)}&status=active", operator).list("items[*].id"))
        assertEquals(listOf(linked.id), call("GET", "/api/v1/tenants?q=${q(tag)}&breakPolicyChange=scheduled", operator).list("items[*].id"))
        for ((state, id) in listOf("linked" to linked.id, "pending" to pending.id, "none" to nobody.id)) {
            assertEquals(listOf(id), call("GET", "/api/v1/tenants?q=${q(tag)}&administration=$state", operator).list("items[*].id"))
        }
        val seen = mutableListOf<String>()
        var cursor: String? = null
        do {
            val page = call("GET", "/api/v1/tenants?limit=1&q=${q(tag)}" + (cursor?.let { "&cursor=$it" } ?: ""), operator)
            assertEquals(200, page.status, page.toString())
            seen += page.list("items[*].id")
            cursor = page.at("nextCursor")
        } while (cursor != null)
        assertEquals(listOf(linked.id, pending.id, nobody.id), seen)

        val summary = call("GET", "/api/v1/tenants/summary?q=${q(tag)}", operator)
        assertEquals(200, summary.status, summary.toString())
        assertEquals(listOf(3, 2, 1), listOf<Int>(summary.at("total"), summary.at("active"), summary.at("suspended")))
        assertEquals(mapOf("linked" to 1, "pending" to 1, "none" to 1), summary.at<Map<String, Int>>("administration"))
        assertEquals(1, summary.at<Int>("breakPolicyChange"))
        assertTrue(call("GET", "/api/v1/tenants/summary", operator).at<Int>("total") >= 3)

        // La empresa no ve el estado de su administración desde su propia vista.
        assertFalse("administration" in call("GET", "/api/v1/tenant", linked.adminToken).body)

        for (bad in listOf("status=borrada", "status=ACTIVE", "administration=quien", "breakPolicyChange=si", "q=${"x".repeat(101)}")) {
            assertProblem(422, "validation", call("GET", "/api/v1/tenants?$bad", operator))
        }
        assertEquals("too_long", call("GET", "/api/v1/tenants/summary?q=${"x".repeat(101)}", operator).at("errors[0].code"))
        for (path in listOf("/api/v1/tenants", "/api/v1/tenants/summary")) {
            assertProblem(401, "unauthorized", call("GET", path, null))
            assertProblem(403, "forbidden", call("GET", path, linked.adminToken))
        }

        // Al reactivarla, la suspensión se borra; la historia queda en la bitácora.
        assertEquals(200, call("POST", "/api/v1/tenants/${pending.id}/reactivation", operator, """{"reason":"Pago recibido del periodo."}""").status)
        assertNull(item(call("GET", "/api/v1/tenants?q=${q(tag)}&status=active", operator), pending.id)["suspension"])
    }

    @Test
    fun `the console reads the usage of every company for a month in pages, cut in each zone, with totals that add up`() {
        val month = YearMonth.now(zone)
        assumeTrue(YearMonth.now(tokyo) == month, "las dos zonas deben estar en el mismo mes")
        val tag = marker()
        val mexico = named("Uso Centro $tag")
        val japan = named("Uso Oriente $tag", timeZone = "Asia/Tokyo")
        val first = Instant.now().minusSeconds(300)
        val second = Instant.now().minusSeconds(180)
        assumeTrue(YearMonth.from(first.atZone(zone)) == month, "los dos marcajes deben caer en el mismo mes")
        val marking = newEmployee(mexico)
        val card = newCard(mexico, marking)
        val phone = phone(mexico, marking)
        assertEquals(201, mark(phone, card, first).status)
        assertEquals(201, mark(phone, card, second).status)
        fun usage(query: String, path: String = "/api/v1/tenants/usage") = call("GET", "$path?month=$month&q=${q(tag)}$query", operator)

        val page = usage("&limit=200")
        assertEquals(200, page.status, page.toString())
        assertEquals(listOf(mexico.id, japan.id), page.list("items[*].id"))
        val counts = listOf("employeesWithAttendance", "attendanceEvents", "employeesInPeriod", "cardsAssigned", "devicesActive")
        @Suppress("UNCHECKED_CAST")
        fun usageOf(id: String) = item(page, id)["usage"] as Map<String, Any?>
        assertEquals(listOf(1, 2, 1, 1, 1), counts.map { usageOf(mexico.id)[it] })
        assertEquals(listOf(0, 0, 0, 0, 0), counts.map { usageOf(japan.id)[it] })
        // Cada empresa en su propia zona.
        assertEquals(month.atDay(1).atStartOfDay(tokyo).toInstant().toString(), usageOf(japan.id)["from"])
        assertEquals(month.plusMonths(1).atDay(1).atStartOfDay(zone).toInstant().toString(), usageOf(mexico.id)["to"])
        assertEquals("Uso Oriente $tag", item(page, japan.id)["name"])
        // Los mismos conteos que el uso de una sola empresa.
        val single = call("GET", "/api/v1/tenants/${mexico.id}/usage?month=$month", operator)
        assertEquals(usageOf(mexico.id), usageOf(mexico.id).keys.associateWith { single.at<Any?>(it) })
        // Sólo conteos: nada de las personas.
        for (id in listOf(marking, mexico.adminId, japan.adminId)) assertFalse(id in page.body, page.body)
        assertFalse(mexico.adminEmail in page.body, page.body)

        val totals = usage("", "/api/v1/tenants/usage/summary")
        assertEquals(200, totals.status, totals.toString())
        assertEquals(listOf(month.toString(), 2, 0), listOf<Any>(totals.at("month"), totals.at("tenants"), totals.at("complete")))
        assertEquals(listOf(1, 2, 1, 1, 1), counts.map { totals.at<Int>(it) })

        val pages = mutableListOf<String>()
        var cursor: String? = null
        do {
            val next = usage("&limit=1" + (cursor?.let { "&cursor=$it" } ?: ""))
            assertEquals(200, next.status, next.toString())
            pages += next.list("items[*].id")
            cursor = next.at("nextCursor")
        } while (cursor != null)
        assertEquals(listOf(mexico.id, japan.id), pages)

        suspend(japan.id)
        assertEquals(listOf(mexico.id), usage("&status=active").list("items[*].id"))
        assertEquals(1, usage("&status=suspended", "/api/v1/tenants/usage/summary").at<Int>("tenants"))

        // Un mes en que las empresas todavía no existían no las lista.
        val before = call("GET", "/api/v1/tenants/usage?month=${month.minusMonths(1)}&q=${q(tag)}", operator)
        assertEquals(emptyList(), before.list("items[*].id"))
        val beforeTotals = call("GET", "/api/v1/tenants/usage/summary?month=${month.minusMonths(1)}&q=${q(tag)}", operator)
        assertEquals(listOf(0, 0, 0), listOf<Int>(beforeTotals.at("tenants"), beforeTotals.at("attendanceEvents"), beforeTotals.at("employeesInPeriod")))

        val future = YearMonth.now(ZoneOffset.ofHours(14)).plusMonths(1)
        for (path in listOf("/api/v1/tenants/usage", "/api/v1/tenants/usage/summary")) {
            for (bad in listOf("", "?month=", "?month=2026-13", "?month=octubre")) {
                val reply = call("GET", "$path$bad", operator)
                assertProblem(422, "validation", reply)
                assertEquals("invalid_month", reply.at<String>("errors[0].code"), "$path$bad: $reply")
            }
            assertEquals("future_month", call("GET", "$path?month=$future", operator).at<String>("errors[0].code"))
            assertProblem(422, "validation", call("GET", "$path?month=$month&status=borrada", operator))
            assertProblem(401, "unauthorized", call("GET", "$path?month=$month", null))
            assertProblem(403, "forbidden", call("GET", "$path?month=$month", mexico.adminToken))
        }
    }

    @Test
    fun `the operator invites another administrator only when nobody administers the company with an account`() {
        val tag = marker()
        val c = named("Invitación $tag")
        val other = company()
        val rh = member(c, "rh")
        val tenant = UUID.fromString(c.id)
        fun listed() = administration(call("GET", "/api/v1/tenants?q=${q(tag)}", operator), c.id)
        val reason = "Quien administraba dejó la empresa y la dirección pidió tomarla."
        fun invite(tenantId: String, email: String, token: String? = operator, why: String? = reason) =
            call("POST", "/api/v1/tenants/$tenantId/administrators", token, json(mapOf("email" to email, "reason" to why)))
        fun roles(token: String) = call("GET", "/api/v1/me", token).list("roles")
        fun people() = count("select count(*) from tenant_user where tenant_id = ?", tenant)
        val next = email("direccion")

        assertProblem(401, "unauthorized", invite(c.id, next, token = null))
        assertProblem(403, "forbidden", invite(c.id, next, token = c.adminToken))
        assertProblem(403, "forbidden", invite(c.id, next, token = rh.token))
        // Mientras alguien la administra con su cuenta, es esa persona quien invita.
        assertProblem(409, "administrator_linked", invite(c.id, next))
        val path = "/api/v1/tenants/${c.id}/administrators"
        for (bad in listOf(
            "{}", """{"email":"$next"}""", """{"reason":"$reason"}""", """{"email":"$next","reason":"corto"}""",
            """{"email":"sin-arroba","reason":"$reason"}""", """{"email":"$next","reason":"$reason","roles":["rh"]}""",
        )) {
            assertProblem(422, "validation", call("POST", path, operator, bad))
        }
        assertProblem(404, "not_found", invite(UUID.randomUUID().toString(), next))
        assertProblem(404, "not_found", invite("no-es-un-identificador", next))
        val people = people()

        // Quien la administraba perdió su cuenta: tras soltar la liga, nadie con cuenta la administra.
        val unlink = call(
            "POST", "/api/v1/tenants/${c.id}/administrators/unlink", operator,
            json(mapOf("email" to c.adminEmail, "reason" to "Perdió su cuenta y dejó la empresa.")),
        )
        assertEquals(204, unlink.status, unlink.toString())
        // El correo sigue el mismo control que el alta, y la respuesta no dice de quién es.
        for (taken in listOf(other.adminEmail, rh.email, c.adminEmail, OPERATOR)) {
            assertProblem(409, "email_unavailable", invite(c.id, taken))
        }
        assertEquals(people, people())

        val done = invite(c.id, next.uppercase())
        assertEquals(201, done.status, done.toString())
        assertEquals(listOf(next, "invited"), listOf<String>(done.at("email"), done.at("status")))
        assertNull(done.at<Any?>("linkedAt"))
        assertEquals(listOf("pending", 2), listed().let { listOf(it["state"], it["total"]) })

        // Entra con ese correo verificado y administra; desde ahí invita ella.
        val newAdmin = token(subject(), next)
        assertEquals(listOf("admin_empresa"), roles(newAdmin))
        assertProblem(409, "administrator_linked", invite(c.id, email("otra")))
        assertEquals("linked", listed()["state"])

        // Queda en la bitácora de la empresa, con el motivo y que fue desde la operación.
        val audit = call("GET", "/api/v1/audit-log?limit=200&action=user.invited", newAdmin)
        val entry = audit.at<List<Map<String, Any?>>>("items[?(@.metadata.by=='operator')]").single()
        assertEquals(mapOf("roles" to "admin_empresa", "by" to "operator", "reason" to reason), entry["metadata"])
        assertFalse(reason in call("GET", "/api/v1/audit-log?limit=200", other.adminToken).body)

        // Una invitación del alta que nunca se usó, o una empresa suspendida, también lo admiten.
        val typoTag = marker()
        val typo = named("Correo equivocado $typoTag", linked = false)
        suspend(typo.id)
        assertEquals(201, invite(typo.id, email("correcto")).status)
        assertEquals(2, administration(call("GET", "/api/v1/tenants?status=suspended&q=${q(typoTag)}", operator), typo.id)["total"])
    }
}
