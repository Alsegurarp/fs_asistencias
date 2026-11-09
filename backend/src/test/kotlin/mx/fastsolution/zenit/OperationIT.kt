package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Operación del portal: incidencias, cierres y bitácora con los filtros, los
 * conteos y los nombres que resuelve el servidor.
 */
@Tag("integration")
class OperationIT : WorkdayTestBase() {
    private fun incidents(c: Company, query: String = "", token: String = c.adminToken): Reply =
        call("GET", "/api/v1/incidents$query", token)

    private fun ids(reply: Reply): List<String> {
        assertEquals(200, reply.status, reply.toString())
        return reply.list("items[*].id")
    }

    private fun named(c: Company, userId: String, name: String) {
        val renamed = call("PATCH", "/api/v1/users/$userId", c.adminToken, json(mapOf("displayName" to name)))
        assertEquals(200, renamed.status, renamed.toString())
    }

    private fun employee(c: Company, id: String): Reply = call("GET", "/api/v1/employees/$id", c.adminToken)

    private fun assign(c: Company, incidentId: String, userId: String?, token: String = c.adminToken): Reply =
        patch(c, incidentId, json(mapOf("assigneeUserId" to userId)), token)

    private fun errorCode(reply: Reply): String {
        assertProblem(422, "validation", reply)
        return reply.at("errors[0].code")
    }

    @Test
    fun `incidents are filtered, ordered and counted on the server, with the names of who attends them`() {
        val c = companyWithFinishedWeek()
        named(c, c.adminId, "Mariana Ortiz")
        val siteId = newSite(c)
        val one = staffed(c, siteId)
        val two = staffed(c, siteId)
        val three = staffed(c)
        val rh = member(c, "rh")
        // Semana que terminó: dos de severidad media y una baja. Semana en curso: una alta.
        val foreign = marked(one, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        marked(one, before(32))
        val missing = marked(two, before(40), declared = "clock_out").at<String>("incident.id")
        marked(two, before(32))
        marked(three, before(40))
        val duplicate = marked(three, before(39, 59)).at<String>("incident.id")
        marked(three, before(32))
        val ahead = mark(three.phone, three.card, Instant.now().plusSeconds(1200))
        assertEquals("clock_anomaly", ahead.at("incident.type"))
        val anomaly = ahead.at<String>("incident.id")

        assertEquals(listOf(foreign, missing, duplicate, anomaly), ids(incidents(c)))
        assertEquals(listOf(anomaly, foreign, missing, duplicate), ids(incidents(c, "?sort=severity")))
        // El cursor por severidad cruza de una severidad a la siguiente sin saltar ni repetir.
        val walked = mutableListOf<String>()
        var cursor: String? = null
        do {
            val page = incidents(c, "?sort=severity&limit=1" + (cursor?.let { "&cursor=$it" } ?: ""))
            walked += ids(page)
            cursor = page.at<String?>("nextCursor")
        } while (cursor != null)
        assertEquals(listOf(anomaly, foreign, missing, duplicate), walked)
        assertEquals(listOf(foreign, missing), ids(incidents(c, "?severity=medium")))
        assertEquals(listOf(anomaly), ids(incidents(c, "?severity=high")))
        // Bloquean un cierre las abiertas de la semana que terminó; la de esta semana todavía no.
        assertEquals(listOf(foreign, missing, duplicate), ids(incidents(c, "?blocksClosure=true")))
        assertEquals(listOf(anomaly), ids(incidents(c, "?blocksClosure=false")))

        val detail = incidents(c, "/$foreign")
        val person = employee(c, one.employeeId)
        assertEquals(
            listOf<Any?>(person.at("displayName"), person.at("externalId"), true, null, null, null, null),
            listOf<Any?>(
                detail.at("employeeName"), detail.at("employeeExternalId"), detail.at("blocksClosure"), detail.at("assigneeName"),
                detail.at("assignedAt"), detail.at("assignedBy"), detail.at("assignedByName"),
            ),
        )
        assertEquals(before(40), Instant.parse(detail.at("occurredAt")))

        // Asignar guarda quién y cuándo, con sus nombres.
        val assigned = assign(c, foreign, rh.id)
        assertEquals(
            listOf(rh.id, "Persona rh", c.adminId, "Mariana Ortiz"),
            listOf<String>(assigned.at("assigneeUserId"), assigned.at("assigneeName"), assigned.at("assignedBy"), assigned.at("assignedByName")),
        )
        assertNotNull(Instant.parse(assigned.at("assignedAt")))
        assertEquals(listOf(foreign), ids(incidents(c, "?assignee=me", rh.token)))
        assertEquals(emptyList(), ids(incidents(c, "?assignee=me")))
        assertEquals(listOf(missing, duplicate, anomaly), ids(incidents(c, "?assignee=unassigned")))
        assertEquals(listOf(foreign), ids(incidents(c, "?assignee=assigned")))
        // Por nombre o número de la persona, sin acentos ni mayúsculas, antes de paginar y junto con otros filtros.
        val number = employee(c, three.employeeId).at<String>("externalId")
        assertEquals(listOf(duplicate, anomaly), ids(incidents(c, "?q=${number.lowercase()}")))
        assertEquals(listOf(anomaly), ids(incidents(c, "?q=$number&limit=1&sort=severity")))
        assertEquals(listOf(duplicate), ids(incidents(c, "?q=$number&severity=low")))
        assertEquals(listOf(foreign, missing, duplicate, anomaly), ids(incidents(c, "?q=p%C3%A9rsona")))
        assertEquals(emptyList(), ids(incidents(c, "?q=nadie-con-este-nombre")))

        val counts = incidents(c, "/summary", rh.token)
        assertEquals(200, counts.status, counts.toString())
        assertEquals(today.toString(), counts.at("weekStart"))
        assertEquals(
            mapOf("total" to 4, "unassigned" to 3, "mine" to 1, "high" to 1, "medium" to 2, "low" to 1, "blockingClosure" to 3),
            counts.at<Map<String, Int>>("open"),
        )
        assertEquals(mapOf("total" to 0, "thisWeek" to 0), counts.at<Map<String, Int>>("resolved"))
        assertEquals(1, incidents(c, "/summary?type=foreign_site").at<Int>("open.total"))
        assertEquals(0, incidents(c, "/summary?siteId=${newSite(c)}").at<Int>("open.total"))

        // Resolver deja el nombre de quien resolvió y mueve los conteos.
        val resolved = patch(c, duplicate, resolution("justified", "Pasó la tarjeta dos veces por error."), rh.token)
        assertEquals(200, resolved.status, resolved.toString())
        assertEquals("Persona rh", resolved.at("resolution.resolvedByName"))
        assertEquals(false, resolved.at("blocksClosure"))
        val after = incidents(c, "/summary")
        assertEquals(listOf(3, 2, 1, 1), listOf<Int>(after.at("open.total"), after.at("open.blockingClosure"), after.at("resolved.total"), after.at("resolved.thisWeek")))
        assertEquals(listOf(duplicate), ids(incidents(c, "?status=resolved&sort=resolved")))

        // Quitar la asignación borra quién y cuándo.
        val released = assign(c, foreign, null)
        assertEquals(listOf<Any?>(null, null, null, null), listOf<Any?>(released.at("assigneeName"), released.at("assignedAt"), released.at("assignedBy"), released.at("assignedByName")))

        for (bad in listOf("?severity=grave", "?assignee=yo", "?blocksClosure=si", "?sort=nombre", "?sort=resolved", "?sort=resolved&status=open", "?q=${"x".repeat(101)}")) {
            assertProblem(422, "validation", incidents(c, bad))
        }
        // Un cursor de otro orden daría una página equivocada.
        val bySeverity = incidents(c, "?sort=severity&limit=1").at<String>("nextCursor")
        val byOpening = incidents(c, "?limit=1").at<String>("nextCursor")
        assertEquals("invalid_cursor", errorCode(incidents(c, "?cursor=$bySeverity")))
        assertEquals("invalid_cursor", errorCode(incidents(c, "?sort=severity&cursor=$byOpening")))
    }

    @Test
    fun `an incident is offered and assigned only to whoever can resolve it`() {
        val c = companyWithFinishedWeek()
        val siteA = newSite(c)
        val siteB = newSite(c)
        val one = staffed(c, siteA)
        val incident = marked(one, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        val rh = member(c, "rh")
        val supervisorA = member(c, "supervisor")
        val supervisorB = member(c, "supervisor")
        val unplaced = member(c, "supervisor")
        val auditor = member(c, "auditor")
        val worker = linkedWorker(c, newEmployee(c))
        val gone = member(c, "rh")
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisorA.id}", c.adminToken, """{"siteIds":["$siteA"]}""").status)
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisorB.id}", c.adminToken, """{"siteIds":["$siteB"]}""").status)
        assertEquals(200, call("PATCH", "/api/v1/users/${gone.id}", c.adminToken, """{"disabled":true}""").status)

        fun offered(token: String = c.adminToken, query: String = "") = call("GET", "/api/v1/incidents/$incident/assignees$query", token)
        val list = offered()
        assertEquals(listOf(c.adminId, rh.id, supervisorA.id), ids(list))
        assertEquals(listOf("supervisor"), list.at<List<String>>("items[2].roles"))
        assertEquals("Persona supervisor", list.at("items[2].displayName"))
        assertEquals(list.body, offered(rh.token).body)
        assertEquals(list.body, offered(supervisorA.token).body)
        val first = offered(query = "?limit=1")
        assertEquals(listOf(c.adminId), ids(first))
        assertEquals(listOf(rh.id), ids(offered(query = "?limit=1&cursor=${first.at<String>("nextCursor")}")))
        // Quien no ve la incidencia no sabe que existe; Auditoría no asigna.
        assertProblem(404, "not_found", offered(supervisorB.token))
        assertProblem(403, "forbidden", offered(auditor.token))
        assertProblem(403, "forbidden", offered(worker.token))

        // La asignación acepta exactamente a quienes la lista ofrece.
        for (who in listOf(supervisorB.id, unplaced.id, auditor.id, worker.id)) {
            assertEquals("assignee_cannot_resolve", errorCode(assign(c, incident, who)), who)
        }
        assertEquals("user_not_found", errorCode(assign(c, incident, gone.id)))
        assertNull(incidents(c, "/$incident").at<Any?>("assigneeUserId"))
        val taken = assign(c, incident, supervisorA.id, supervisorA.token)
        assertEquals(listOf(supervisorA.id, supervisorA.id), listOf<String>(taken.at("assigneeUserId"), taken.at("assignedBy")))

        // Sin sede, sólo Administración y RH la pueden resolver.
        val roaming = staffed(c)
        val siteless = marked(roaming, before(40), declared = "clock_out").at<String>("incident.id")
        assertNull(incidents(c, "/$siteless").at<Any?>("siteId"))
        assertEquals(listOf(c.adminId, rh.id), ids(call("GET", "/api/v1/incidents/$siteless/assignees", c.adminToken)))
        assertEquals("assignee_cannot_resolve", errorCode(assign(c, siteless, supervisorA.id)))
    }

    @Test
    fun `an incident blocks a closure only while its finished week stays open for that person`() {
        val c = companyWithFinishedWeek()
        val one = staffed(c)
        val two = staffed(c)
        marked(one, before(40))
        val duplicate = marked(one, before(39, 59)).at<String>("incident.id")
        marked(one, before(32))
        shift(two, 40, 32)
        fun summary() = call("GET", "/api/v1/week-closures/summary?week=$yesterday", c.adminToken)
        fun blocks(id: String) = incidents(c, "/$id").at<Boolean>("blocksClosure")

        assertTrue(blocks(duplicate))
        assertEquals(listOf(0, 1), listOf<Int>(summary().at("closed"), summary().at("blocked")))
        assertEquals(201, close(c).status)
        assertEquals(listOf(1, 1), listOf<Int>(summary().at("closed"), summary().at("blocked")))
        assertTrue(blocks(duplicate))

        assertEquals(200, patch(c, duplicate, resolution("justified", "Pasó la tarjeta dos veces por error.")).status)
        assertEquals(false, blocks(duplicate))
        assertEquals(201, close(c).status)
        assertEquals(listOf(2, 0), listOf<Int>(summary().at("closed"), summary().at("blocked")))

        // Abierta en una semana ya cerrada: no bloquea nada, pide reabrir.
        val late = marked(one, before(5))
        assertEquals("late_sync", late.at("incident.type"))
        assertEquals(false, blocks(late.at("incident.id")))
        assertEquals(0, summary().at<Int>("blocked"))
    }

    @Test
    fun `closures are filtered by site, status and acknowledgement, with the names of who closed them`() {
        val c = companyWithFinishedWeek()
        named(c, c.adminId, "Mariana Ortiz")
        val siteA = newSite(c)
        val a = staffed(c, siteA)
        val b = staffed(c)
        val d = staffed(c)
        for (who in listOf(a, b, d)) shift(who, 40, 32)
        val closed = close(c)
        assertEquals(201, closed.status, closed.toString())
        val ofA = closureOf(closed, a.employeeId)["id"] as String
        val ofB = closureOf(closed, b.employeeId)["id"] as String
        val firstOfD = closureOf(closed, d.employeeId)["id"] as String
        assertEquals(201, acknowledge(ofA, linkedWorker(c, a.employeeId).token).status)
        assertEquals(201, acknowledge(ofB, linkedWorker(c, b.employeeId).token, """{"type":"objected","note":"Falta mi salida del jueves."}""").status)
        assertEquals(200, reopen(firstOfD, c.adminToken).status)
        val secondOfD = closureOf(close(c, listOf(d.employeeId)), d.employeeId)["id"] as String

        // Los cierres de una misma petición comparten la hora: se comparan como conjunto.
        fun closures(query: String) = call("GET", "/api/v1/week-closures?week=$yesterday$query", c.adminToken)
        assertEquals(setOf(ofA, ofB, firstOfD, secondOfD), ids(closures("")).toSet())
        assertEquals(listOf(firstOfD), ids(closures("&status=reopened")))
        assertEquals(setOf(ofA, ofB, secondOfD), ids(closures("&status=closed")).toSet())
        assertEquals(listOf(ofA), ids(closures("&acknowledgement=agreed")))
        assertEquals(listOf(ofB), ids(closures("&acknowledgement=objected")))
        assertEquals(setOf(firstOfD, secondOfD), ids(closures("&acknowledgement=none")).toSet())
        assertEquals(listOf(secondOfD), ids(closures("&status=closed&acknowledgement=none")))
        assertEquals(listOf(ofA), ids(closures("&siteId=$siteA")))
        for (bad in listOf("&status=abierta", "&acknowledgement=talvez", "&siteId=x")) assertProblem(422, "validation", closures(bad))

        val row = closures("&siteId=$siteA")
        val person = employee(c, a.employeeId)
        assertEquals(
            listOf(person.at("displayName"), person.at("externalId"), c.adminId, "Mariana Ortiz"),
            listOf<String>(row.at("items[0].employeeName"), row.at("items[0].employeeExternalId"), row.at("items[0].closedBy"), row.at("items[0].closedByName")),
        )

        fun summary(query: String = "") = call("GET", "/api/v1/week-closures/summary?week=$yesterday$query", c.adminToken)
        val counts = summary()
        assertEquals(200, counts.status, counts.toString())
        assertEquals(listOf<Any>(lastWeek.toString(), 3, 1, 0), listOf<Any>(counts.at("weekStart"), counts.at("closed"), counts.at("reopened"), counts.at("blocked")))
        assertEquals(mapOf("agreed" to 1, "objected" to 1, "none" to 1), counts.at<Map<String, Int>>("acknowledgements"))
        assertEquals(mapOf("agreed" to 1, "objected" to 0, "none" to 0), summary("&siteId=$siteA").at<Map<String, Int>>("acknowledgements"))
        assertProblem(422, "validation", call("GET", "/api/v1/week-closures/summary", c.adminToken))
    }

    @Test
    fun `the audit log names who acted and what they touched, and keeps every incident that opens`() {
        val c = companyWithFinishedWeek()
        named(c, c.adminId, "Mariana Ortiz")
        val siteId = newSite(c)
        val one = staffed(c, siteId)
        val incident = marked(one, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        val rh = member(c, "rh")
        assertEquals(200, assign(c, incident, rh.id).status)
        val name = employee(c, one.employeeId).at<String>("displayName")

        val log = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(200, log.status, log.toString())
        fun entry(action: String): Map<String, Any?> = log.at<List<Map<String, Any?>>>("items[?(@.action=='$action')]").first()
        fun actor(action: String) = entry(action)["actor"] as Map<*, *>
        fun target(action: String) = entry(action)["target"] as Map<*, *>

        // La captura abre la incidencia: queda con el sistema como actor.
        assertEquals(mapOf("type" to "system", "id" to null, "displayName" to null), actor("incident.opened"))
        assertEquals(listOf(incident, name), listOf(target("incident.opened")["id"], target("incident.opened")["displayName"]))
        assertEquals(mapOf("type" to "foreign_site"), entry("incident.opened")["metadata"])
        assertEquals("Mariana Ortiz", actor("incident.assigned")["displayName"])
        assertEquals(name, target("incident.assigned")["displayName"])
        assertEquals(name, target("employee.created")["displayName"])
        assertEquals("Persona rh", target("user.invited")["displayName"])
        assertTrue((target("card.registered")["displayName"] as String).startsWith("ZN-"))
        assertTrue((target("site.created")["displayName"] as String).startsWith("Sede "))
        assertNotNull(target("device.activated")["displayName"])
        // Lo que no tiene nombre no lo inventa.
        assertNull(target("tenant.updated")["displayName"])
    }
}
