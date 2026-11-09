package mx.fastsolution.zenit

import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Tag
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Asistencia de la empresa: la tabla de semanas por persona y los totales del panel. */
@Tag("integration")
class CompanyAttendanceIT : WorkdayTestBase() {
    private fun weeks(c: Company, query: String, token: String = c.adminToken): Reply =
        call("GET", "/api/v1/attendance/weeks$query", token)

    private fun summary(c: Company, query: String = "", token: String = c.adminToken): Reply =
        call("GET", "/api/v1/attendance/summary$query", token)

    private fun ids(reply: Reply): List<String> {
        assertEquals(200, reply.status, reply.toString())
        return reply.list("items[*].employeeId")
    }

    @Test
    fun `only staff roles read the company attendance, and each company only its own`() {
        val c = companyWithFinishedWeek()
        val other = companyWithFinishedWeek()
        val mine = staffed(c)
        shift(mine, 40, 32)
        val theirs = staffed(other)
        shift(theirs, 40, 32)
        val people = linkedMapOf(
            "admin_empresa" to c.adminToken,
            "rh" to member(c, "rh").token,
            "supervisor" to member(c, "supervisor").token,
            "auditor" to member(c, "auditor").token,
            "trabajador" to linkedWorker(c, mine.employeeId).token,
        )
        for (path in listOf("/api/v1/attendance/weeks?week=$yesterday", "/api/v1/attendance/summary?date=$yesterday")) {
            assertProblem(401, "unauthorized", call("GET", path, null))
            assertProblem(403, "forbidden", call("GET", path, operator))
            for ((role, token) in people) {
                val reply = call("GET", path, token)
                if (role == "trabajador") assertProblem(403, "forbidden", reply) else assertEquals(200, reply.status, "$role $path: $reply")
            }
        }
        // Lo de otra empresa no aparece ni suma.
        assertEquals(listOf(mine.employeeId), ids(weeks(c, "?week=$yesterday")))
        assertEquals(listOf(theirs.employeeId), ids(weeks(other, "?week=$yesterday")))
        assertEquals(1, summary(c, "?date=$yesterday").at<Int>("people"))
        assertEquals(0, ids(weeks(c, "?week=$yesterday&siteId=${newSite(other)}")).size)
    }

    @Test
    fun `each row adds up exactly what the week of that person says, frozen once it is closed`() {
        val c = companyWithFinishedWeek()
        val siteId = newSite(c)
        val regular = staffed(c, siteId)
        val long = staffed(c, siteId)
        val idle = staffed(c)
        shift(regular, 40, 32)
        shift(long, 40, 26)

        val rows = weeks(c, "?week=$yesterday")
        assertEquals(listOf(regular.employeeId, long.employeeId, idle.employeeId), ids(rows))
        assertEquals(listOf(lastWeek.toString(), "America/Mexico_City"), listOf(rows.at("weekStart"), rows.at<String>("timeZone")))
        for (who in listOf(regular, long, idle)) {
            val own = week(c, who.employeeId)
            val row = "items[?(@.employeeId=='${who.employeeId}')]"
            assertEquals(own.at<Map<String, Int>>("totals"), rows.at<List<Map<String, Int>>>("$row.totals").single())
            assertEquals(own.at<List<Any>>("alerts"), rows.at<List<List<Any>>>("$row.alerts").single())
            assertEquals(own.at<Map<String, Any>>("ruleSet"), rows.at<List<Map<String, Any>>>("$row.ruleSet").single())
            // La semana ya terminó: no hay «hoy».
            assertEquals(listOf(null), rows.at<List<Any?>>("$row.today"))
        }
        val overtime = week(c, long.employeeId).at<Int>("totals.overtimeMinutes")
        assertTrue(overtime > 0, "doce horas en un día pasan el máximo ordinario")
        assertEquals(listOf(long.employeeId), ids(weeks(c, "?week=$yesterday&attention=overtime")))
        assertEquals(listOf(regular.employeeId, long.employeeId), ids(weeks(c, "?week=$yesterday&siteId=$siteId")))

        // Una página a la vez, sin repetir ni saltar a nadie.
        val first = weeks(c, "?week=$yesterday&limit=2")
        assertEquals(listOf(regular.employeeId, long.employeeId), ids(first))
        val rest = weeks(c, "?week=$yesterday&limit=2&cursor=${first.at<String>("nextCursor")}")
        assertEquals(listOf(idle.employeeId), ids(rest))
        assertNull(rest.at<Any?>("nextCursor"))

        // Cerrada, la fila trae lo que se congeló, igual que la semana de la persona.
        val closure = closureOf(close(c, listOf(long.employeeId)), long.employeeId)
        val closed = weeks(c, "?week=$yesterday")
        val row = "items[?(@.employeeId=='${long.employeeId}')]"
        assertEquals(listOf(closure["id"], "closed"), listOf(closed.at<List<String>>("$row.closure.id").single(), closed.at<List<String>>("$row.closure.status").single()))
        assertEquals(week(c, long.employeeId).at<Map<String, Int>>("totals"), closed.at<List<Map<String, Int>>>("$row.totals").single())
        assertEquals(week(c, long.employeeId).at<List<Any>>("alerts"), closed.at<List<List<Any>>>("$row.alerts").single())

        for (bad in listOf("", "?week=ayer", "?week=$yesterday&siteId=x", "?week=$yesterday&attention=otra", "?week=$yesterday&limit=0", "?week=$yesterday&cursor=x")) {
            assertProblem(422, "validation", weeks(c, bad))
        }
        // «Hoy» sólo existe en la semana de hoy.
        assertProblem(422, "validation", weeks(c, "?week=$yesterday&attention=no_entry_today"))
        assertProblem(422, "validation", weeks(c, "?week=$yesterday&attention=on_shift"))
    }

    @Test
    fun `the table searches by name or number in the server, before paging`() {
        val c = companyWithFinishedWeek()
        val first = staffed(c)
        val second = staffed(c)
        shift(first, 40, 32)
        shift(second, 40, 26)
        val rows = weeks(c, "?week=$yesterday")
        fun external(who: Staffed): String = rows.at<List<String>>("items[?(@.employeeId=='${who.employeeId}')].externalId").single()

        // Por número, sin distinguir mayúsculas.
        assertEquals(listOf(second.employeeId), ids(weeks(c, "?week=$yesterday&q=${external(second).lowercase()}")))
        // Por nombre, sin distinguir acentos: «pérsona» encuentra a «Persona».
        assertEquals(listOf(first.employeeId, second.employeeId), ids(weeks(c, "?week=$yesterday&q=p%C3%A9rsona")))
        // Se busca antes de paginar: la primera página ya es la del resultado.
        assertEquals(listOf(second.employeeId), ids(weeks(c, "?week=$yesterday&limit=1&q=${external(second)}")))
        // Se combina con los demás filtros.
        assertEquals(listOf(second.employeeId), ids(weeks(c, "?week=$yesterday&attention=overtime&q=persona")))
        assertEquals(emptyList(), ids(weeks(c, "?week=$yesterday&attention=overtime&q=${external(first)}")))
        // Los conteos del panel no dependen de la búsqueda.
        assertEquals(2, summary(c, "?date=$yesterday").at<Int>("people"))
        assertProblem(422, "validation", weeks(c, "?week=$yesterday&q=${"x".repeat(101)}"))
    }

    @Test
    fun `the summary counts the same people the table shows, and what needs a look`() {
        val c = companyWithFinishedWeek()
        val siteId = newSite(c)
        val done = staffed(c, siteId)
        val forgot = staffed(c, siteId)
        val outside = staffed(c, siteId)
        shift(done, 40, 32)
        // Entró y no marcó la salida: ese tramo ya no es un turno en curso.
        marked(forgot, before(30))
        // Marcó fuera de su sede, ayer en la madrugada.
        val foreign = marked(outside, before(20), location = here(latitude = 19.44))
        assertEquals("foreign_site", foreign.at("incident.type"))
        marked(outside, before(18))

        val totals = summary(c, "?date=$yesterday")
        assertEquals(200, totals.status, totals.toString())
        assertEquals(listOf(yesterday.toString(), lastWeek.toString(), null), listOf(totals.at("date"), totals.at<String>("weekStart"), totals.at<String?>("siteId")))
        assertEquals(3, totals.at<Int>("people"))
        // Ayer sólo marcó quien salió de su sede: dos marcajes.
        assertEquals(mapOf("marked" to 1, "attendanceEvents" to 2, "onShift" to null, "noEntry" to null, "foreignSite" to 1), totals.at<Map<String, Any?>>("day"))
        val ordinary = listOf(done, forgot, outside).sumOf { week(c, it.employeeId).at<Int>("totals.ordinaryMinutes") }
        assertEquals(
            mapOf("ordinaryMinutes" to ordinary, "overtimeMinutes" to 0, "withOvertime" to 0, "withAttention" to 2, "missingExit" to 1),
            totals.at<Map<String, Any?>>("week"),
        )
        assertEquals(mapOf("open" to 1, "highSeverity" to 0, "unassigned" to 1), totals.at<Map<String, Any?>>("incidents"))
        assertEquals(mapOf("weekStart" to lastWeek.minusDays(7).toString(), "people" to 3, "closed" to 0, "agreed" to 0, "objected" to 0), totals.at<Map<String, Any?>>("previousWeek"))
        assertEquals(3, totals.at<Int>("devices.active"))
        // Quien necesita revisión en la tabla es quien cuenta el panel.
        assertEquals(listOf(forgot.employeeId, outside.employeeId), ids(weeks(c, "?week=$yesterday&attention=alerts")))

        // La semana siguiente cuenta los cierres y acuses de esta.
        val closureId = closureOf(close(c, listOf(done.employeeId)), done.employeeId)["id"] as String
        assertEquals(201, acknowledge(closureId, linkedWorker(c, done.employeeId).token, """{"type":"objected","note":"Faltó un día."}""").status)
        val next = summary(c)
        assertEquals(mapOf("weekStart" to lastWeek.toString(), "people" to 3, "closed" to 1, "agreed" to 0, "objected" to 1), next.at<Map<String, Any?>>("previousWeek"))
        assertEquals(today.toString(), next.at("date"))

        // Supervisión no consulta dispositivos: el panel no se los cuenta.
        val supervisor = member(c, "supervisor")
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken, """{"siteIds":["$siteId"]}""").status)
        val scoped = summary(c, "?date=$yesterday", supervisor.token)
        assertEquals(200, scoped.status, scoped.toString())
        assertNull(scoped.at<Any?>("devices"))

        assertProblem(422, "validation", summary(c, "?date=${today.plusDays(1)}"))
        assertProblem(422, "validation", summary(c, "?date=ayer"))
        assertProblem(422, "validation", summary(c, "?siteId=x"))
    }

    @Test
    fun `today tells who is on shift, who already left and who has not marked`() {
        // Hacen falta diez minutos de hoy para marcar sin salir del día.
        val now = Instant.now().truncatedTo(ChronoUnit.SECONDS)
        assumeTrue(now.minusSeconds(600).isAfter(midnight), "recién pasó la medianoche")
        val c = companyWithFinishedWeek()
        val working = staffed(c)
        val gone = staffed(c)
        val absent = staffed(c)
        val entry = now.minusSeconds(300)
        marked(working, entry)
        marked(gone, now.minusSeconds(540))
        val exit = now.minusSeconds(420)
        marked(gone, exit)

        val rows = weeks(c, "?week=$today")
        fun today(who: Staffed): Map<String, Any?> = rows.at<List<Map<String, Any?>>>("items[?(@.employeeId=='${who.employeeId}')].today").single()
        assertEquals(mapOf("state" to "on_shift", "since" to entry.toString(), "lastMarkAt" to entry.toString()), today(working))
        assertEquals(mapOf("state" to "off_shift", "since" to null, "lastMarkAt" to exit.toString()), today(gone))
        assertEquals(mapOf("state" to "no_entry", "since" to null, "lastMarkAt" to null), today(absent))
        // El turno en curso no es algo por revisar: todavía no sale.
        assertEquals(emptyList(), ids(weeks(c, "?week=$today&attention=alerts")))
        assertEquals(listOf(working.employeeId), ids(weeks(c, "?week=$today&attention=on_shift")))
        assertEquals(listOf(absent.employeeId), ids(weeks(c, "?week=$today&attention=no_entry_today")))

        val totals = summary(c)
        assertEquals(mapOf("marked" to 2, "attendanceEvents" to 3, "onShift" to 1, "noEntry" to 1, "foreignSite" to 0), totals.at<Map<String, Any?>>("day"))
        assertEquals(0, totals.at<Int>("week.missingExit"))
    }

    @Test
    fun `supervision sees only the people of its sites, and not a week that mixes another site`() {
        val c = companyWithFinishedWeek()
        val mine = newSite(c)
        val foreign = newSite(c)
        val inside = staffed(c, mine)
        val elsewhere = staffed(c, foreign)
        val mixed = staffed(c, mine)
        shift(inside, 40, 32)
        shift(elsewhere, 40, 32)
        // Marca en la terminal de la otra sede.
        val terminal = terminal(c, foreign)
        assertEquals(201, mark(terminal, mixed.card, before(40)).status)
        assertEquals(201, mark(terminal, mixed.card, before(32)).status)
        val supervisor = member(c, "supervisor")
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken, """{"siteIds":["$mine"]}""").status)

        assertEquals(listOf(inside.employeeId, elsewhere.employeeId, mixed.employeeId), ids(weeks(c, "?week=$yesterday")))
        assertEquals(listOf(inside.employeeId), ids(weeks(c, "?week=$yesterday", supervisor.token)))
        assertEquals(1, summary(c, "?date=$yesterday", supervisor.token).at<Int>("people"))
        // Es la misma regla de la semana de una persona.
        assertProblem(403, "forbidden", week(c, mixed.employeeId, supervisor.token))
        assertEquals(0, ids(weeks(c, "?week=$yesterday&siteId=$foreign", supervisor.token)).size)
        // Sin sedes no ve a nadie.
        val nobody = member(c, "supervisor")
        assertEquals(200, call("PATCH", "/api/v1/users/${nobody.id}", c.adminToken, """{"siteIds":[]}""").status)
        assertEquals(0, ids(weeks(c, "?week=$yesterday", nobody.token)).size)
        assertNotNull(summary(c, "?date=$yesterday", nobody.token).at<Int>("people"))
    }
}
