package mx.fastsolution.zenit

import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Tag
import java.time.Instant
import java.time.YearMonth
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/** Uso de una empresa en un mes, para facturar: sólo conteos y sólo para quien opera el servicio. */
@Tag("integration")
class UsageIT : WorkdayTestBase() {
    private fun usage(id: String, month: String?, token: String? = operator): Reply =
        call("GET", "/api/v1/tenants/$id/usage" + (month?.let { "?month=$it" } ?: ""), token)

    @Test
    fun `the operator reads a month of one company as counts, without data of people or of other companies`() {
        val c = company()
        val other = company()
        val first = Instant.now().minusSeconds(300)
        val second = Instant.now().minusSeconds(180)
        val month = YearMonth.from(second.atZone(zone))
        assumeTrue(YearMonth.from(first.atZone(zone)) == month, "los dos marcajes deben caer en el mismo mes")

        val marking = newEmployee(c)
        val card = newCard(c, marking)
        val phone = phone(c, marking)
        assertEquals(201, mark(phone, card, first).status)
        assertEquals(201, mark(phone, card, second).status)
        // Vigente en el padrón, sin tarjeta ni marcajes.
        val idle = newEmployee(c)
        // Lo de otra empresa no se cuenta aquí.
        val elsewhere = newEmployee(other)
        assertEquals(201, mark(phone(other, elsewhere), newCard(other, elsewhere), first).status)

        val reply = usage(c.id, month.toString())
        assertEquals(200, reply.status, reply.toString())
        assertEquals(listOf(c.id, month.toString(), "America/Mexico_City"), listOf<String>(reply.at("tenantId"), reply.at("month"), reply.at("timeZone")))
        assertEquals(month.atDay(1).atStartOfDay(zone).toInstant().toString(), reply.at("from"))
        assertEquals(month.plusMonths(1).atDay(1).atStartOfDay(zone).toInstant().toString(), reply.at("to"))
        assertFalse(reply.at<Boolean>("complete"))
        assertEquals(1, reply.at<Int>("employeesWithAttendance"))
        assertEquals(2, reply.at<Int>("attendanceEvents"))
        assertEquals(2, reply.at<Int>("employeesInPeriod"))
        assertEquals(1, reply.at<Int>("cardsAssigned"))
        assertEquals(1, reply.at<Int>("devicesActive"))
        // Ni identificadores ni nombres de personas.
        for (id in listOf(marking, idle, c.adminId)) assertFalse(id in reply.body, reply.body)
        assertFalse("Persona" in reply.body, reply.body)

        // El mes anterior ya terminó: las mismas personas eran vigentes, pero nada más ocurrió.
        val previous = usage(c.id, month.minusMonths(1).toString())
        assertEquals(200, previous.status, previous.toString())
        assertEquals(true, previous.at<Boolean>("complete"))
        assertEquals(
            listOf(0, 0, 2, 0, 0),
            listOf("employeesWithAttendance", "attendanceEvents", "employeesInPeriod", "cardsAssigned", "devicesActive").map { previous.at<Int>(it) },
        )
    }

    @Test
    fun `only the operator reads usage, of a company that exists, for a month that already started`() {
        val c = company()
        val rh = member(c, "rh")
        val now = YearMonth.now(zone).toString()

        assertProblem(401, "unauthorized", usage(c.id, now, token = null))
        assertProblem(403, "forbidden", usage(c.id, now, token = c.adminToken))
        assertProblem(403, "forbidden", usage(c.id, now, token = rh.token))
        for (bad in listOf(null, "", "2026-13", "2026-1", "26-10", "octubre")) {
            val reply = usage(c.id, bad)
            assertProblem(422, "validation", reply)
            assertEquals("invalid_month", reply.at<String>("errors[0].code"), "$bad: $reply")
        }
        val future = usage(c.id, YearMonth.now(zone).plusMonths(1).toString())
        assertProblem(422, "validation", future)
        assertEquals("future_month", future.at<String>("errors[0].code"))
        assertProblem(404, "not_found", usage(UUID.randomUUID().toString(), now))
        assertProblem(404, "not_found", usage("no-es-un-identificador", now))
        // Un mes anterior a la empresa existe y está vacío.
        assertEquals(0, usage(c.id, "2020-01").at<Int>("employeesInPeriod"))
    }
}
