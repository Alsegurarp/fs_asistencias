package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/**
 * Padrón para el portal: búsqueda por texto, filtros y conteos en el servidor
 * para personas, tarjetas y lectores, y el historial de importaciones.
 */
@Tag("integration")
class DirectorySearchIT : WorkdayTestBase() {
    private fun ids(reply: Reply): List<String> {
        assertEquals(200, reply.status, reply.toString())
        return reply.list("items[*].id")
    }

    private fun errorCode(reply: Reply): String {
        assertProblem(422, "validation", reply)
        return reply.at("errors[0].code")
    }

    private fun person(c: Company, externalId: String, name: String, siteId: String? = null): String {
        val reply = call("POST", "/api/v1/employees", c.adminToken, json(mapOf("externalId" to externalId, "displayName" to name, "siteId" to siteId, "employmentStart" to "2026-01-05")))
        assertEquals(201, reply.status, reply.toString())
        return reply.at("id")
    }

    private fun schedule(c: Company, name: String): String {
        val reply = call(
            "POST", "/api/v1/schedules", c.adminToken,
            """{"name":"$name","timeZone":"America/Mexico_City","validFrom":"${today.minusDays(30)}","validTo":null,"days":[""" +
                """{"dayOfWeek":"monday","startTime":"08:00","endTime":"16:00","breakMinutes":30}]}""",
        )
        assertEquals(201, reply.status, reply.toString())
        return reply.at("id")
    }

    private fun onSchedule(c: Company, employeeId: String, scheduleId: String) {
        val reply = call("POST", "/api/v1/employees/$employeeId/schedule-assignments", c.adminToken, """{"scheduleId":"$scheduleId","validFrom":"${today.minusDays(1)}"}""")
        assertEquals(201, reply.status, reply.toString())
    }

    private fun card(c: Company, label: String): String {
        val reply = call("POST", "/api/v1/cards", c.adminToken, """{"label":"$label","fingerprint":"${UUID.randomUUID().toString().replace("-", "")}"}""")
        assertEquals(201, reply.status, reply.toString())
        return reply.at("id")
    }

    private fun give(c: Company, cardId: String, employeeId: String) {
        val reply = call("POST", "/api/v1/cards/$cardId/assignments", c.adminToken, """{"employeeId":"$employeeId"}""")
        assertEquals(201, reply.status, reply.toString())
    }

    @Test
    fun `people are searched and filtered on the server, without case or accents, and counted the same way`() {
        val c = company()
        val north = newSite(c)
        val south = newSite(c)
        val jose = person(c, "N-100", "José Núñez", north)
        val ana = person(c, "A-187", "Ana Torres", north)
        val mariana = person(c, "M-300", "Mariana Ortiz", south)
        val literal = person(c, "X-1", "Prueba 50%_uno", south)
        val day = schedule(c, "Diurno")
        val night = schedule(c, "Nocturno")
        onSchedule(c, jose, day)
        onSchedule(c, ana, day)
        onSchedule(c, mariana, night)
        val anaCard = card(c, "T-0031")
        give(c, anaCard, ana)
        fun people(query: String, token: String = c.adminToken) = ids(call("GET", "/api/v1/employees$query", token))

        assertEquals(listOf(jose), people("?q=jose"))
        assertEquals(listOf(jose), people("?q=NUÑ"))
        assertEquals(listOf(jose), people("?q=nun"))
        assertEquals(listOf(ana), people("?q=187"))
        assertEquals(listOf(ana, mariana), people("?q=%20an%20"))
        // Un comodín del texto se busca tal cual.
        assertEquals(listOf(literal), people("?q=%25"))
        assertEquals(listOf(literal), people("?q=_"))
        assertEquals(listOf(jose, ana), people("?scheduleId=$day"))
        assertEquals(listOf(jose, mariana, literal), people("?withoutCard=true"))
        assertEquals(listOf(ana), people("?withoutCard=false"))
        assertEquals(listOf(ana), people("?q=torres&siteId=$north&scheduleId=$day&withoutCard=false"))
        assertEquals("T-0031", call("GET", "/api/v1/employees/$ana", c.adminToken).at("activeCardLabel"))
        assertNull(call("GET", "/api/v1/employees/$jose", c.adminToken).at<Any?>("activeCardLabel"))

        val counts = call("GET", "/api/v1/employees/summary", c.adminToken)
        assertEquals(200, counts.status, counts.toString())
        assertEquals(listOf(4, 4, 0, 3, 1), listOf<Int>(counts.at("total"), counts.at("active"), counts.at("inactive"), counts.at("withoutCard"), counts.at("withoutSchedule")))
        assertEquals(listOf(mapOf("scheduleId" to day, "people" to 2), mapOf("scheduleId" to night, "people" to 1)), counts.at<List<Map<String, Any>>>("bySchedule"))
        assertEquals(2, call("GET", "/api/v1/employees/summary?q=an", c.adminToken).at<Int>("total"))
        assertEquals(0, call("GET", "/api/v1/employees/summary?status=inactive", c.adminToken).at<Int>("total"))

        // Supervisión busca sólo en sus sedes, también al contar.
        val supervisor = member(c, "supervisor")
        assertEquals(200, call("PATCH", "/api/v1/users/${supervisor.id}", c.adminToken, """{"siteIds":["$north"]}""").status)
        assertEquals(listOf(ana), people("?q=an", supervisor.token))
        assertEquals(2, call("GET", "/api/v1/employees/summary", supervisor.token).at<Int>("total"))

        assertEquals("too_long", errorCode(call("GET", "/api/v1/employees?q=${"a".repeat(101)}", c.adminToken)))
        for (bad in listOf("?withoutCard=si", "?scheduleId=x", "?status=todas")) assertProblem(422, "validation", call("GET", "/api/v1/employees$bad", c.adminToken))
        assertProblem(422, "validation", call("GET", "/api/v1/employees/summary?q=${"a".repeat(101)}", c.adminToken))
    }

    @Test
    fun `cards are searched by label and by whoever had them last, and counted by status`() {
        val c = company()
        val ana = person(c, "A-187", "Ana Torres")
        val jose = person(c, "N-100", "José Núñez")
        val active = card(c, "T-0031")
        val spare = card(c, "T-0099")
        val lost = card(c, "T-0019")
        give(c, active, ana)
        give(c, lost, jose)
        assertEquals(200, call("POST", "/api/v1/cards/$lost/revocation", c.adminToken, """{"reason":"lost"}""").status)
        fun cards(query: String) = ids(call("GET", "/api/v1/cards$query", c.adminToken))

        assertEquals(listOf(active), cards("?q=ana"))
        assertEquals(listOf(spare), cards("?q=0099"))
        // Quien la tuvo por última vez la encuentra aunque ya no la tenga.
        assertEquals(listOf(lost), cards("?q=jose"))
        assertEquals(listOf(lost), cards("?status=lost&status=damaged"))
        assertEquals(listOf(active, spare), cards("?status=active&status=inventory"))

        val list = call("GET", "/api/v1/cards", c.adminToken)
        val held = "items[?(@.id=='$active')]"
        val gone = "items[?(@.id=='$lost')]"
        assertEquals(listOf("Ana Torres"), list.at<List<String>>("$held.assignment.employeeName"))
        assertEquals(listOf("A-187"), list.at<List<String>>("$held.assignment.employeeExternalId"))
        assertEquals(listOf(null), list.at<List<Any?>>("$held.latestAssignment.until"))
        assertEquals(listOf(null), list.at<List<Any?>>("$gone.assignment"))
        assertEquals(listOf("José Núñez"), list.at<List<String>>("$gone.latestAssignment.employeeName"))
        assertNotNull(list.at<List<String?>>("$gone.latestAssignment.until").single())
        assertEquals(listOf(null), list.at<List<Any?>>("items[?(@.id=='$spare')].latestAssignment"))

        val counts = call("GET", "/api/v1/cards/summary", c.adminToken)
        assertEquals(200, counts.status, counts.toString())
        assertEquals(3, counts.at<Int>("total"))
        assertEquals(
            mapOf("inventory" to 1, "assigned" to 0, "active" to 1, "lost" to 1, "damaged" to 0, "revoked" to 0, "replaced" to 0),
            counts.at<Map<String, Int>>("byStatus"),
        )
        assertEquals(1, call("GET", "/api/v1/cards/summary?q=jose", c.adminToken).at<Int>("total"))
        assertProblem(422, "validation", call("GET", "/api/v1/cards?status=perdida", c.adminToken))
    }

    @Test
    fun `devices are searched by label, model and owner, and the silent ones use the panel's threshold`() {
        val c = companyWithFinishedWeek()
        val siteId = newSite(c)
        val ana = person(c, "A-187", "Ana Torres", siteId)
        val jose = person(c, "N-100", "José Núñez", siteId)
        val anaPhone = phone(c, ana)
        val front = terminal(c, siteId)
        val josePhone = phone(c, jose)
        assertEquals(200, call("POST", "/api/v1/devices/${josePhone.id}/revocation", c.adminToken, """{"reason":"El teléfono se perdió en la bodega."}""").status)
        change("update device set last_seen_at = now() where id = ?", UUID.fromString(anaPhone.id))
        change("update device set last_seen_at = now() - interval '2 days' where id = ?", UUID.fromString(front.id))
        fun devices(query: String) = ids(call("GET", "/api/v1/devices$query", c.adminToken))

        assertEquals(listOf(front.id), devices("?q=recepcion"))
        assertEquals(listOf(anaPhone.id), devices("?q=ana"))
        assertEquals(listOf(front.id), devices("?silent=true"))
        assertEquals(listOf(josePhone.id), devices("?status=revoked&status=replaced"))
        assertEquals(listOf(anaPhone.id), devices("?mode=personal&status=active"))
        val list = call("GET", "/api/v1/devices", c.adminToken)
        assertEquals(listOf("Ana Torres"), list.at<List<String>>("items[?(@.id=='${anaPhone.id}')].employeeName"))
        assertEquals(listOf(null), list.at<List<Any?>>("items[?(@.id=='${front.id}')].employeeName"))

        val counts = call("GET", "/api/v1/devices/summary", c.adminToken)
        assertEquals(200, counts.status, counts.toString())
        assertEquals(listOf(2, 1, 1, 0), listOf<Int>(counts.at("active"), counts.at("silent"), counts.at("revoked"), counts.at("replaced")))
        // Los tres son del mismo modelo: buscar por él los trae en el orden en que se activaron.
        assertEquals(listOf(anaPhone.id, front.id, josePhone.id), devices("?q=MODELO%201"))
        assertEquals(1, call("GET", "/api/v1/devices/summary?mode=terminal", c.adminToken).at<Int>("active"))
        // El panel cuenta con el mismo umbral.
        assertEquals(1, call("GET", "/api/v1/attendance/summary", c.adminToken).at<Int>("devices.silent"))
        for (bad in listOf("?silent=si", "?status=perdido", "?mode=reloj")) assertProblem(422, "validation", call("GET", "/api/v1/devices$bad", c.adminToken))
    }

    @Test
    fun `the import history names the file and who uploaded it, and a review is applied only with the same file`() {
        val c = company()
        val rh = member(c, "rh")
        val csv = "external_id,display_name,employment_start,site_name\nI-1,Persona Uno,2026-01-05,\nI-2,Persona Dos,2026-01-05,\n".toByteArray()
        val other = "external_id,display_name,employment_start,site_name\nI-3,Persona Tres,2026-01-05,\n".toByteArray()
        val reviewed = upload("/api/v1/imports/csv", rh.token, csv, fileName = "carpeta/padron-noviembre.csv")
        assertEquals(202, reviewed.status, reviewed.toString())
        val reviewId = reviewed.at<String>("id")
        assertEquals(listOf("ready", "padron-noviembre.csv", rh.id, "Persona rh"), listOf<String>(reviewed.at("status"), reviewed.at("fileName"), reviewed.at("createdBy"), reviewed.at("createdByName")))
        assertNull(reviewed.at<Any?>("appliedByImportId"))

        // Aplicar la revisión exige el mismo archivo, byte por byte.
        assertProblem(409, "review_mismatch", upload("/api/v1/imports/csv", rh.token, other, dryRun = "false", reviewedImportId = reviewId))
        assertEquals("requires_apply", errorCode(upload("/api/v1/imports/csv", rh.token, csv, dryRun = "true", reviewedImportId = reviewId)))
        assertEquals("import_not_found", errorCode(upload("/api/v1/imports/csv", rh.token, csv, dryRun = "false", reviewedImportId = UUID.randomUUID().toString())))
        assertEquals("invalid_identifier", errorCode(upload("/api/v1/imports/csv", rh.token, csv, dryRun = "false", reviewedImportId = "x")))
        assertEquals(0, count("select count(*) from employee where tenant_id = ?", UUID.fromString(c.id)))
        val applied = upload("/api/v1/imports/csv", c.adminToken, csv, dryRun = "false", reviewedImportId = reviewId, fileName = "padron-noviembre.csv")
        assertEquals(202, applied.status, applied.toString())
        assertEquals(listOf("applied", reviewId), listOf<String>(applied.at("status"), applied.at("reviewedImportId")))
        assertEquals(2, count("select count(*) from employee where tenant_id = ?", UUID.fromString(c.id)))
        // Una revisión se aplica una vez, y sólo una revisión lista se aplica.
        assertProblem(409, "review_already_applied", upload("/api/v1/imports/csv", c.adminToken, csv, dryRun = "false", reviewedImportId = reviewId))
        assertProblem(409, "review_not_applicable", upload("/api/v1/imports/csv", c.adminToken, csv, dryRun = "false", reviewedImportId = applied.at("id")))

        val history = call("GET", "/api/v1/imports", rh.token)
        assertEquals(listOf(applied.at<String>("id"), reviewId), ids(history))
        assertEquals(listOf<Any?>(applied.at("id"), null), history.at<List<Any?>>("items[*].appliedByImportId").reversed())
        assertEquals("Persona rh", history.at("items[1].createdByName"))
        assertEquals(listOf(applied.at<String>("id")), ids(call("GET", "/api/v1/imports?status=applied", rh.token)))
        val first = call("GET", "/api/v1/imports?limit=1", rh.token)
        assertEquals(listOf(reviewId), ids(call("GET", "/api/v1/imports?limit=1&cursor=${first.at<String>("nextCursor")}", rh.token)))
        assertEquals(applied.at<String>("id"), call("GET", "/api/v1/imports/$reviewId", rh.token).at("appliedByImportId"))
        assertProblem(422, "validation", call("GET", "/api/v1/imports?status=revisada", rh.token))
    }
}
