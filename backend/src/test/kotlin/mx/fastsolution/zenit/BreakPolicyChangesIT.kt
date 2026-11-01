package mx.fastsolution.zenit

import mx.fastsolution.zenit.tenant.BreakPolicySchedule
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Tag
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * La política de comida ya no cambia al instante: se programa y entra el
 * primer día de semana de la empresa dentro de la siguiente quincena, con al
 * menos siete días de aviso.
 */
@Tag("integration")
class BreakPolicyChangesIT : WorkdayTestBase() {
    private val body = """{"breakPolicy":"marked","reason":"Desde la siguiente quincena se registra la comida."}"""

    private fun schedule(token: String, payload: String = body) = call("POST", "/api/v1/tenant/break-policy-changes", token, payload)

    private fun cancel(token: String, changeId: String) = call("POST", "/api/v1/tenant/break-policy-changes/$changeId/cancellation", token)

    @Test
    fun `a change is scheduled for the next quincena, announced, and does not apply before it enters`() {
        val c = company()
        val who = staffed(c)
        val scheduled = schedule(c.adminToken)
        assertEquals(201, scheduled.status, scheduled.toString())
        val expected = BreakPolicySchedule.effectiveOn(today, "monday")
        assertEquals(expected.toString(), scheduled.at("effectiveOn"))
        assertEquals(expected.atStartOfDay(zone).toInstant().toString(), scheduled.at("effectiveAt"))

        // Hasta que entra, la empresa sigue con la que tenía y avisa del cambio.
        val tenant = call("GET", "/api/v1/tenant", member(c, "auditor").token)
        assertEquals("not_considered", tenant.at("breakPolicy"))
        assertEquals(scheduled.at<String>("id"), tenant.at("breakPolicyChange.id"))
        assertEquals("Desde la siguiente quincena se registra la comida.", tenant.at("breakPolicyChange.reason"))
        val me = call("GET", "/api/v1/me", c.adminToken)
        assertEquals("not_considered", me.at("tenant.breakPolicy"))
        assertEquals(expected.toString(), me.at("tenant.upcomingBreakPolicy.effectiveOn"))
        val session = call("POST", "/api/v1/device-sessions", assertion(who.phone), """{"appVersion":"0.1.1"}""")
        assertEquals(201, session.status, session.toString())
        assertEquals("not_considered", session.at("breakPolicy"))
        assertEquals("marked", session.at("upcomingBreakPolicy.breakPolicy"))
        assertEquals(scheduled.at<String>("effectiveAt"), session.at("upcomingBreakPolicy.effectiveAt"))
        // Una marca de hoy se interpreta con la política de hoy.
        who.phone.session = session.at("sessionId")
        who.phone.sequence = 0
        assertEquals(listOf("clock_in", "clock_out"), listOf(30L, 10L).map { mark(who.phone, who.card, Instant.now().minusSeconds(it * 60)).at<String>("type") })
        assertEquals(1, count("select count(*) from audit_log where tenant_id = ? and action = 'tenant.break_policy_change_scheduled'", UUID.fromString(c.id)))

        // Uno a la vez, y nunca hacia la política que ya tiene.
        assertProblem(409, "break_policy_change_pending", schedule(c.adminToken))
        val cancelled = cancel(c.adminToken, scheduled.at("id"))
        assertEquals(204, cancelled.status, cancelled.toString())
        assertProblem(409, "break_policy_change_not_pending", cancel(c.adminToken, scheduled.at("id")))
        assertNull(call("GET", "/api/v1/tenant", c.adminToken).at<Any?>("breakPolicyChange"))
        assertNull(call("GET", "/api/v1/me", c.adminToken).at<Any?>("tenant.upcomingBreakPolicy"))
        assertProblem(422, "validation", schedule(c.adminToken, """{"breakPolicy":"not_considered","reason":"Ya es la que tiene la empresa."}"""))
        assertProblem(422, "validation", schedule(c.adminToken, """{"breakPolicy":"marked","reason":"corto"}"""))
        assertProblem(422, "validation", schedule(c.adminToken, """{"breakPolicy":"a veces","reason":"Una política que no existe."}"""))
        assertEquals(201, schedule(c.adminToken).status)
    }

    @Test
    fun `the policy no longer changes instantly and the week start waits for a scheduled change`() {
        val c = company()
        val instant = call("PATCH", "/api/v1/tenant", c.adminToken, """{"breakPolicy":"marked"}""")
        assertProblem(422, "validation", instant)
        assertEquals("scheduled_change_required", instant.at("errors[0].code"))
        assertEquals("not_considered", call("GET", "/api/v1/tenant", c.adminToken).at("breakPolicy"))

        assertEquals(201, schedule(c.adminToken).status)
        assertProblem(409, "break_policy_change_pending", call("PATCH", "/api/v1/tenant", c.adminToken, """{"weekStartsOn":"sunday"}"""))
        // Lo demás sí cambia, también el mismo inicio de semana que ya tenía.
        assertEquals(200, call("PATCH", "/api/v1/tenant", c.adminToken, """{"name":"Empresa con cambio programado","weekStartsOn":"monday"}""").status)
    }

    @Test
    fun `the operator schedules and cancels for a company, and nobody reaches the change of another company`() {
        val a = company()
        val b = company()
        val forA = call("POST", "/api/v1/tenants/${a.id}/break-policy-changes", operator, body)
        assertEquals(201, forA.status, forA.toString())
        assertEquals(forA.at<String>("id"), call("GET", "/api/v1/tenant", a.adminToken).at("breakPolicyChange.id"))
        assertEquals(1, count("select count(*) from audit_log where tenant_id = ? and action = 'tenant.break_policy_change_scheduled'", UUID.fromString(a.id)))

        // Lo de A no existe para B ni por la ruta de otra empresa.
        assertProblem(404, "not_found", cancel(b.adminToken, forA.at("id")))
        assertProblem(404, "not_found", call("POST", "/api/v1/tenants/${b.id}/break-policy-changes/${forA.at<String>("id")}/cancellation", operator))
        assertProblem(404, "not_found", call("POST", "/api/v1/tenants/${UUID.randomUUID()}/break-policy-changes", operator, body))
        assertNull(call("GET", "/api/v1/tenant", b.adminToken).at<Any?>("breakPolicyChange"))
        // B programa el suyo sin chocar con el de A.
        assertEquals(201, schedule(b.adminToken).status)

        assertEquals(204, call("POST", "/api/v1/tenants/${a.id}/break-policy-changes/${forA.at<String>("id")}/cancellation", operator).status)
        assertNull(call("GET", "/api/v1/tenant", a.adminToken).at<Any?>("breakPolicyChange"))
        assertEquals(1, count("select count(*) from audit_log where tenant_id = ? and action = 'tenant.break_policy_change_cancelled'", UUID.fromString(a.id)))
        // Quien opera no usa la ruta de una empresa, y quien administra no usa la del operador.
        assertProblem(403, "forbidden", schedule(operator))
        assertProblem(403, "forbidden", call("POST", "/api/v1/tenants/${a.id}/break-policy-changes", a.adminToken, body))
    }

    @Test
    fun `once it enters, each mark and each week keep the policy of their own day`() {
        // Hacen falta marcas de hoy después de la medianoche, antes de ahora.
        assumeTrue(Duration.between(midnight, Instant.now()) > Duration.ofMinutes(50), "corre después de la primera hora del día")
        val c = companyWithFinishedWeek()
        val who = staffed(c)
        // Simula un cambio que se programó hace semanas y entró hoy, al empezar la semana.
        val changeId = UUID.randomUUID()
        change(
            "insert into break_policy_change (tenant_id, id, break_policy, effective_on, reason) values (?, ?, 'marked', ?, ?)",
            UUID.fromString(c.id), changeId, today, "Cambio programado que entró hoy.",
        )

        val older = listOf(4L, 3L, 2L, 1L).map { marked(who, before(it)).at<String>("type") }
        assertEquals(listOf("clock_in", "clock_out", "clock_in", "clock_out"), older)
        val after = listOf(10L, 20L, 30L, 40L).map { marked(who, midnight.plusSeconds(it * 60)).at<String>("type") }
        assertEquals(listOf("clock_in", "break_start", "break_end", "clock_out"), after)

        val tenant = call("GET", "/api/v1/tenant", c.adminToken)
        assertEquals("marked", tenant.at("breakPolicy"))
        assertNull(tenant.at<Any?>("breakPolicyChange"))
        val previous = call("GET", "/api/v1/employees/${who.employeeId}/attendance?week=$lastWeek", c.adminToken)
        assertEquals(listOf(120, 0), listOf(previous.at<Int>("totals.workedMinutes"), previous.at<Int>("totals.breakMinutes")))
        val current = call("GET", "/api/v1/employees/${who.employeeId}/attendance?week=$today", c.adminToken)
        assertEquals(listOf(20, 10), listOf(current.at<Int>("totals.workedMinutes"), current.at<Int>("totals.breakMinutes")))
        // Ya entró: no se cancela; se corrige programando otro.
        assertProblem(409, "break_policy_change_not_pending", cancel(c.adminToken, changeId.toString()))
    }
}
