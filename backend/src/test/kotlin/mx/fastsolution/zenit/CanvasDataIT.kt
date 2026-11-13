package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Datos que el lienzo muestra y el API no traía (contrato 0.37.0). Cada uno
 * con lo que no debe salir: a quién no se le muestra y qué no permite hacer.
 */
@Tag("integration")
class CanvasDataIT : WorkdayTestBase() {
    @Test
    fun `a closure says its days worked, the schedule of the week and the incidents resolved, and the summary counts the people`() {
        val c = companyWithFinishedWeek()
        val siteId = newSite(c)
        val ana = staffed(c, siteId)
        val beto = staffed(c, siteId)
        val schedule = call(
            "POST", "/api/v1/schedules", c.adminToken,
            """{"name":"Turno del lienzo","timeZone":"America/Mexico_City","validFrom":"${lastWeek.minusDays(30)}","validTo":null,"days":[""" +
                """{"dayOfWeek":"monday","startTime":"08:00","endTime":"16:30","breakMinutes":30}]}""",
        )
        assertEquals(201, schedule.status, schedule.toString())
        val assigned = call(
            "POST", "/api/v1/employees/${ana.employeeId}/schedule-assignments", c.adminToken,
            """{"scheduleId":"${schedule.at<String>("id")}","validFrom":"${lastWeek.minusDays(7)}"}""",
        )
        assertEquals(201, assigned.status, assigned.toString())
        // Ana trabaja dos días; Beto uno, con una marca fuera de su sede que se resuelve.
        shift(ana, 52, 44)
        shift(ana, 28, 20)
        val incidentId = marked(beto, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        marked(beto, before(32))
        assertEquals(200, patch(c, incidentId, resolution("justified", "El supervisor confirmó la ubicación de la persona.")).status)

        val closed = close(c)
        val first = closureOf(closed, ana.employeeId)
        assertEquals(listOf(2, "Turno del lienzo", 0), listOf(first["daysWorked"], first["scheduleName"], first["resolvedIncidents"]))
        val second = closureOf(closed, beto.employeeId)
        assertEquals(listOf(1, null, 1), listOf(second["daysWorked"], second["scheduleName"], second["resolvedIncidents"]))
        // La lista de cierres trae lo mismo.
        val listed = call("GET", "/api/v1/week-closures?week=$yesterday", c.adminToken)
        assertEquals(200, listed.status, listed.toString())
        assertEquals(1, listed.at<List<Int>>("items[?(@.employeeId=='${beto.employeeId}')].resolvedIncidents").single())

        // «39 de 42»: las personas de la semana, también por sede.
        val summary = call("GET", "/api/v1/week-closures/summary?week=$yesterday", c.adminToken)
        assertEquals(200, summary.status, summary.toString())
        assertEquals(listOf(2, 2), listOf<Int>(summary.at("people"), summary.at("closed")))
        assertEquals(2, call("GET", "/api/v1/week-closures/summary?week=$yesterday&siteId=$siteId", c.adminToken).at<Int>("people"))
        assertEquals(0, call("GET", "/api/v1/week-closures/summary?week=$yesterday&siteId=${newSite(c)}", c.adminToken).at<Int>("people"))
    }

    @Test
    fun `each mark says the card it was made with, only inside its company`() {
        val c = companyWithFinishedWeek()
        val ana = staffed(c)
        marked(ana, before(30))
        val events = call("GET", "/api/v1/attendance-events?employeeId=${ana.employeeId}&from=${midnight.minusSeconds(3 * 86400)}&to=$midnight", c.adminToken)
        assertEquals(200, events.status, events.toString())
        assertEquals(listOf("ZN-${ana.card.take(8)}"), events.list("items[*].cardLabel"))
        val other = company()
        assertEquals(emptyList(), call("GET", "/api/v1/attendance-events?employeeId=${ana.employeeId}&from=${midnight.minusSeconds(3 * 86400)}&to=$midnight", other.adminToken).list("items[*].cardLabel"))
    }

    @Test
    fun `me lists the sites assigned to a supervisor and nothing for whoever sees the whole company`() {
        val c = company()
        val north = newSite(c)
        newSite(c)
        val supervisor = member(c, "supervisor")
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken, """{"siteIds":["$north"]}""").status)
        val me = call("GET", "/api/v1/me", supervisor.token)
        assertEquals(200, me.status, me.toString())
        assertEquals(listOf(north), me.list("sites[*].id"))
        assertNull(call("GET", "/api/v1/me", c.adminToken).at<Any?>("sites"))
        assertNull(call("GET", "/api/v1/me", member(c, "rh").token).at<Any?>("sites"))
    }

    @Test
    fun `the administration reads who requested each copy of the dossier, without a way to open anyone else's`() {
        val c = company()
        val rh = member(c, "rh")
        assertEquals(200, call("PUT", "/api/v1/users/${c.adminId}/dossier-permission", c.adminToken, """{"enabled":true}""").status)
        assertEquals(200, call("PUT", "/api/v1/users/${rh.id}/dossier-permission", c.adminToken, """{"enabled":true}""").status)
        fun request(token: String) =
            call("POST", "/api/v1/dossiers", token, """{"formatVersion":1}""", mapOf("Idempotency-Key" to UUID.randomUUID().toString()))
        val mine = request(c.adminToken)
        assertEquals(202, mine.status, mine.toString())
        val theirs = request(rh.token)
        assertEquals(202, theirs.status, theirs.toString())

        val history = call("GET", "/api/v1/dossier-history", c.adminToken)
        assertEquals(200, history.status, history.toString())
        // De la más reciente a la más antigua, con quién la pidió.
        assertEquals(listOf("Persona rh", false), listOf(history.at<String>("items[0].requestedByName"), history.at<Boolean>("items[0].own")))
        assertEquals(true, history.at<Boolean>("items[1].own"))
        // Sin identificadores ni huellas: no sirve para consultar ni descargar la copia de otra persona.
        assertFalse(history.body.contains(theirs.at<String>("id")))
        assertFalse(history.body.contains("Sha256") || history.body.contains("\"id\""), history.body)
        assertProblem(404, "not_found", call("GET", "/api/v1/dossiers/${theirs.at<String>("id")}", c.adminToken))
        // La lista propia de cada quien sigue siendo sólo la suya.
        assertEquals(listOf(theirs.at<String>("id")), call("GET", "/api/v1/dossiers", rh.token).list("items[*].id"))

        assertProblem(403, "forbidden", call("GET", "/api/v1/dossier-history", rh.token))
        assertProblem(403, "forbidden", call("GET", "/api/v1/dossier-history", operator))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/dossier-history", null))
        // Otra empresa no ve estas copias.
        assertTrue(call("GET", "/api/v1/dossier-history", company().adminToken).list("items[*].createdAt").isEmpty())
    }
}
