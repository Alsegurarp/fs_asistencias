package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

@Tag("integration")
class OperationalPoliciesIT : WorkdayTestBase() {
    @Test
    fun `auditor reading all sites does not extend supervisor write permissions`() {
        val c = companyWithFinishedWeek()
        val site = newSite(c)
        val otherSite = newSite(c)
        val worker = staffed(c, otherSite)
        val event = marked(worker, before(16), location = null)
        val incident = event.at<String>("incident.id")
        val supervisor = member(c, "supervisor", "auditor")
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken,
            """{"siteIds":["$site"]}""").status)
        assertEquals(200, call("GET", "/api/v1/incidents/$incident", supervisor.token).status)
        assertProblem(404, "not_found", patch(c, incident, """{"assigneeUserId":null}""", supervisor.token))
    }

    @Test
    fun `supervisors have no site access until assigned and changes take effect on the next request`() {
        val c = companyWithFinishedWeek()
        val foreign = company()
        val site = newSite(c)
        val otherSite = newSite(c)
        val someone = staffed(c, site)
        val other = staffed(c, otherSite)
        val first = marked(someone, before(16), location = null)
        marked(someone, before(8))
        val second = marked(other, before(16), location = null)
        marked(other, before(8))
        val supervisor = member(c, "supervisor")
        assertEquals(emptyList(), call("GET", "/api/v1/sites", supervisor.token).list("items[*].id"))
        assertEquals(emptyList(), call("GET", "/api/v1/employees", supervisor.token).list("items[*].id"))
        assertProblem(404, "not_found", week(c, someone.employeeId, supervisor.token))
        assertProblem(422, "validation", call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken,
            """{"siteIds":["${newSite(foreign)}"]}"""))
        val assigned = call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken, """{"siteIds":["$site"]}""")
        assertEquals(listOf(site), assigned.list("siteIds"))
        assertEquals(listOf(site), call("GET", "/api/v1/sites", supervisor.token).list("items[*].id"))
        assertEquals(listOf(someone.employeeId), call("GET", "/api/v1/employees", supervisor.token).list("items[*].id"))
        assertProblem(404, "not_found", call("GET", "/api/v1/sites/$otherSite", supervisor.token))
        assertProblem(404, "not_found", call("GET", "/api/v1/employees/${other.employeeId}", supervisor.token))
        assertEquals(listOf(first.at<String>("incident.id")), call("GET", "/api/v1/incidents", supervisor.token).list("items[*].id"))
        val foreignIncident = second.at<String>("incident.id")
        assertProblem(404, "not_found", call("GET", "/api/v1/incidents/$foreignIncident", supervisor.token))
        assertProblem(404, "not_found", patch(c, foreignIncident, """{"assigneeUserId":null}""", supervisor.token))
        assertEquals(200, week(c, someone.employeeId, supervisor.token).status)
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken, """{"siteIds":[]}""").status)
        assertEquals(emptyList(), call("GET", "/api/v1/incidents", supervisor.token).list("items[*].id"))
        assertProblem(404, "not_found", week(c, someone.employeeId, supervisor.token))
    }

    @Test
    fun `site-limited supervisor never receives a partial week or a mixed-site closure`() {
        val c = companyWithFinishedWeek()
        val site = newSite(c)
        val otherSite = newSite(c)
        val worker = staffed(c, site)
        marked(worker, before(16))
        assertEquals(200, call("PATCH", "/api/v1/employees/${worker.employeeId}", c.adminToken, """{"siteId":"$otherSite"}""").status)
        marked(worker, before(8))
        assertEquals(200, call("PATCH", "/api/v1/employees/${worker.employeeId}", c.adminToken, """{"siteId":"$site"}""").status)
        val closed = closureOf(close(c, listOf(worker.employeeId)), worker.employeeId)
        val supervisor = member(c, "supervisor")
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken, """{"siteIds":["$site"]}""").status)
        assertEquals(403, week(c, worker.employeeId, supervisor.token).status)
        assertProblem(404, "not_found", call("GET", "/api/v1/week-closures/${closed["id"]}", supervisor.token))
        assertEquals(emptyList(), call("GET", "/api/v1/week-closures?week=$yesterday", supervisor.token).list("items[*].id"))
        val broad = member(c, "rh", "supervisor")
        assertEquals(200, week(c, worker.employeeId, broad.token).status)
        val self = linkedWorker(c, worker.employeeId)
        assertEquals(200, call("PATCH", "/api/v1/users/${self.id}", c.adminToken, """{"roles":["supervisor","trabajador"],"siteIds":[]}""").status)
        assertEquals(200, call("GET", "/api/v1/me/attendance?week=$yesterday", self.token).status)
        assertEquals(200, call("GET", "/api/v1/week-closures/${closed["id"]}", self.token).status)
        assertEquals(201, acknowledge(closed["id"].toString(), self.token).status)
    }

    @Test
    fun `deactivation requires an effective date revokes the card and ends only the applicable schedule`() {
        val c = company()
        val employee = newEmployee(c)
        newCard(c, employee)
        val currentCard = call("GET", "/api/v1/employees/$employee", c.adminToken).at<String>("activeCardId")
        val schedule = call("POST", "/api/v1/schedules", c.adminToken, """{"name":"Horario de baja","timeZone":"America/Mexico_City","validFrom":"2026-01-05","days":[{"dayOfWeek":"monday","startTime":"08:00","endTime":"16:00","breakMinutes":0}]}""")
        assertEquals(201, schedule.status, schedule.toString())
        assertEquals(201, call("POST", "/api/v1/employees/$employee/schedule-assignments", c.adminToken,
            """{"scheduleId":"${schedule.at<String>("id")}","validFrom":"2026-01-05"}""").status)
        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$employee", c.adminToken, """{"status":"inactive"}"""))
        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$employee", c.adminToken,
            """{"status":"inactive","employmentEnd":"${today.plusDays(1)}"}"""))
        assertEquals("active", call("GET", "/api/v1/cards", c.adminToken).at<String>("items[0].status"))
        val ended = call("PATCH", "/api/v1/employees/$employee", c.adminToken, """{"status":"inactive","employmentEnd":"$today"}""")
        assertEquals(200, ended.status, ended.toString())
        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$employee", c.adminToken, """{"employmentEnd":null}"""))
        assertNull(ended.at<Any?>("activeCardId"))
        assertEquals("revoked", call("GET", "/api/v1/cards", c.adminToken).at<String>("items[0].status"))
        assertEquals(1, count("select count(*) from schedule_assignment where tenant_id = ? and employee_id = ? and valid_to = ?::date",
            UUID.fromString(c.id), UUID.fromString(employee), today.toString()))
        assertEquals(1, count("select count(*) from card_assignment where tenant_id = ? and card_id = ? and until is not null",
            UUID.fromString(c.id), UUID.fromString(currentCard)))
        assertEquals(200, call("PATCH", "/api/v1/employees/$employee", c.adminToken, """{"status":"active","employmentEnd":null}""").status)
        assertNull(call("GET", "/api/v1/employees/$employee", c.adminToken).at<Any?>("activeCardId"))
    }

    @Test
    fun `offline evidence captured before deactivation can synchronize but new evidence cannot use the revoked card`() {
        val c = company()
        val worker = staffed(c)
        val captured = Instant.now().minusSeconds(600)
        change("update card_assignment set since = ?::timestamptz where tenant_id = ? and employee_id = ?",
            captured.minusSeconds(300).toString(), UUID.fromString(c.id), UUID.fromString(worker.employeeId))
        val key = UUID.randomUUID().toString()
        val offline = envelope(worker.phone, worker.card, captured, key, declared = "clock_in")
        assertEquals(200, call("PATCH", "/api/v1/employees/${worker.employeeId}", c.adminToken,
            """{"status":"inactive","employmentEnd":"$today"}""").status)
        val prior = submit(worker.phone, offline, key)
        assertEquals(201, prior.status, prior.toString())
        assertEquals("accepted", prior.at("outcome"))
        val next = mark(worker.phone, worker.card, Instant.now())
        assertEquals("rejected", next.at("outcome"))
        assertEquals("card_revoked", next.at("rejection.code"))
        assertEquals(prior.body, submit(worker.phone, offline, key).body)
    }
}
