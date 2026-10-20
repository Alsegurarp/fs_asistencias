package mx.fastsolution.zenit

import mx.fastsolution.zenit.workday.ClosureRunJob
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.springframework.beans.factory.annotation.Autowired
import java.sql.DriverManager
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Cierre de la semana como trabajo y cierre programado, con dos empresas. */
@Tag("integration")
class ClosureRunsIT : WorkdayTestBase() {
    @Autowired
    private lateinit var closureRuns: ClosureRunJob

    @BeforeEach
    fun nothingPending() {
        // Lo que otras pruebas dejaron encolado se atiende antes, para que no se mezcle.
        jobWorker.drain(1000)
    }

    private fun wholeWeek() = """{"weekStart":"$yesterday"}"""

    private fun request(c: Company, body: String = wholeWeek(), token: String? = c.adminToken): Reply =
        call("POST", "/api/v1/week-closure-runs", token, body)

    private fun run(c: Company, id: String, token: String? = c.adminToken): Reply = call("GET", "/api/v1/week-closure-runs/$id", token)

    private fun blocked(c: Company, id: String, query: String = ""): Reply =
        call("GET", "/api/v1/week-closure-runs/$id/blocked$query", c.adminToken)

    private fun counts(reply: Reply): List<Any?> =
        listOf(reply.at<Any?>("total"), reply.at<Int>("closed"), reply.at<Int>("blocked.openIncidents"), reply.at<Int>("blocked.openSegment"))

    private fun closures(c: Company): Reply = call("GET", "/api/v1/week-closures?week=$yesterday&limit=200", c.adminToken)

    /** Cambio de esquema hecho con el rol dueño: sólo para provocar una falla a media corrida. */
    private fun asOwner(statement: String) {
        DriverManager.getConnection(databaseUrl, "zenit_migrator", secret("db_migrator_password")).use { db ->
            db.createStatement().use { it.execute(statement) }
        }
    }

    @Test
    fun `a run closes the company as a job, counts whoever it could not close and another run picks up what was left`() {
        val c = companyWithFinishedWeek()
        val tenant = UUID.fromString(c.id)
        val rh = member(c, "rh")
        val siteId = newSite(c)
        val ok = staffed(c, siteId)
        val pending = staffed(c, siteId)
        val unfinished = staffed(c, siteId)
        shift(ok, 40, 32)
        val incidentId = marked(pending, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        marked(pending, before(32))
        marked(unfinished, before(20))

        // Pedirla exige una semana terminada y, si se limita, una sede que exista. No admite lista de personas.
        for (bad in listOf(
            "{}", """{"weekStart":"ayer"}""", """{"weekStart":"$yesterday","todos":true}""",
            """{"weekStart":"$yesterday","siteId":"${UUID.randomUUID()}"}""", """{"weekStart":"$yesterday","siteId":"x"}""",
            """{"weekStart":"$yesterday","employeeIds":["${ok.employeeId}"]}""",
        )) {
            assertProblem(422, "validation", request(c, bad))
        }
        val early = request(c, """{"weekStart":"$today"}""")
        assertProblem(422, "validation", early)
        assertEquals("week_not_finished", early.at("errors[0].code"))
        val noRules = request(c, """{"weekStart":"2000-01-03"}""")
        assertProblem(422, "validation", noRules)
        assertEquals("no_rules_for_date", noRules.at("errors[0].code"))
        assertEquals(0, count("select count(*) from week_closure_run where tenant_id = ?", tenant))

        val asked = request(c, token = rh.token)
        assertEquals(202, asked.status, asked.toString())
        val id = asked.at<String>("id")
        assertEquals(
            listOf("queued", "requested", lastWeek.toString(), rh.id),
            listOf<String>(asked.at("status"), asked.at("origin"), asked.at("weekStart"), asked.at("requestedBy")),
        )
        assertEquals(listOf(null, 0, 0, 0), counts(asked))
        assertEquals(emptyList(), blocked(c, id).list("items[*].employeeId"))
        for (field in listOf("siteId", "failure", "startedAt", "finishedAt")) assertNull(asked.at<Any?>(field), field)
        // Mientras no termina, pedirla otra vez devuelve la misma, con cualquier fecha de esa semana.
        assertEquals(id, request(c, """{"weekStart":"$lastWeek"}""").at("id"))
        assertEquals(1, count("select count(*) from job where tenant_id = ? and type = 'week_closure'", tenant))
        // La de una sede es otro alcance: es otra corrida.
        val ofSite = request(c, """{"weekStart":"$yesterday","siteId":"$siteId"}""").at<String>("id")
        assertNotEquals(id, ofSite)
        // Pedirla no cierra a nadie: eso lo hace el trabajo.
        assertEquals(0, count("select count(*) from week_closure where tenant_id = ?", tenant))
        assertEquals("queued", run(c, id).at("status"))

        assertTrue(jobWorker.drain() >= 2)
        val done = run(c, id)
        assertEquals("done", done.at("status"))
        assertEquals(listOf(3, 1, 1, 1), counts(done))
        assertTrue(Instant.parse(done.at("finishedAt")) >= Instant.parse(done.at("startedAt")))
        // La de la sede encontró a esa persona ya cerrada y la cuenta igual: no creó otro cierre.
        assertEquals(listOf(siteId, "done", 3, 1), listOf(run(c, ofSite).at<String>("siteId"), run(c, ofSite).at<String>("status"), run(c, ofSite).at<Int>("total"), run(c, ofSite).at<Int>("closed")))
        assertEquals(listOf(ok.employeeId), closures(c).list("items[*].employeeId"))
        // El cierre es de quien pidió la corrida.
        assertEquals(listOf(rh.id), closures(c).list("items[*].closedBy"))
        val firstClosure = closures(c).at<String>("items[0].id")
        // A quien dejó un tramo sin cerrar se le abre la incidencia con la que se corrige.
        val open = call("GET", "/api/v1/incidents?status=open&week=$yesterday", c.adminToken)
        assertEquals(setOf(pending.employeeId, unfinished.employeeId), open.list("items[*].employeeId").toSet())
        val forgotten = open.at<List<String>>("items[?(@.employeeId=='${unfinished.employeeId}')].id").single()
        val details = blocked(c, id)
        assertEquals(listOf(pending.employeeId, unfinished.employeeId), details.list("items[*].employeeId"))
        assertEquals(listOf("open_incidents", "open_segment"), details.list("items[*].reason"))
        assertEquals(listOf(incidentId), details.list("items[0].incidentIds[*]"))
        assertEquals(listOf(forgotten), details.list("items[1].incidentIds[*]"))
        val firstPage = blocked(c, id, "?limit=1")
        val lastPage = blocked(c, id, "?limit=1&cursor=${firstPage.at<String>("nextCursor")}")
        assertEquals(details.list("items[*].employeeId"), firstPage.list("items[*].employeeId") + lastPage.list("items[*].employeeId"))
        assertNull(lastPage.at<Any?>("nextCursor"))
        for (bad in listOf("?limit=0", "?limit=201", "?cursor=x")) assertProblem(422, "validation", blocked(c, id, bad))

        // Se resuelve lo pendiente y otra corrida cierra lo que faltó, sin tocar lo ya cerrado.
        val reason = "Lo confirma su supervisor; se corrige la jornada."
        assertEquals(200, patch(c, incidentId, resolution("justified", reason)).status)
        val exit = mapOf("kind" to "add_event", "eventType" to "clock_out", "occurredAt" to before(12).toString())
        assertEquals(200, patch(c, forgotten, resolution("adjusted", reason, exit)).status)
        val second = request(c)
        assertNotEquals(id, second.at<String>("id"))
        jobWorker.drain()
        assertEquals(listOf(3, 3, 0, 0), counts(run(c, second.at("id"))))
        assertEquals(0, blocked(c, second.at("id")).at<Int>("items.length()"))
        assertEquals(details.body, blocked(c, id).body)
        assertEquals(3, closures(c).at<Int>("items.length()"))
        assertEquals(1, closures(c).at<List<Any>>("items[?(@.id=='$firstClosure')]").size)
        assertEquals(3, count("select count(*) from week_closure where tenant_id = ?", tenant))

        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(3, audit.at<List<Any>>("items[?(@.action=='week.closure_run_requested')]").size)
        assertEquals(3, audit.at<List<Any>>("items[?(@.action=='week.closure_run_finished')]").size)
        assertEquals(3, audit.at<List<Any>>("items[?(@.action=='week.closed')]").size)
        assertEquals(setOf("user"), audit.at<List<String>>("items[?(@.action=='week.closed')].actor.type").toSet())
        assertEquals(setOf(rh.id, c.adminId), audit.at<List<String>>("items[?(@.action=='week.closed')].actor.id").toSet())
    }

    @Test
    fun `a run has no cap of people, and what the direct closing refuses for size the run closes`() {
        val c = companyWithFinishedWeek()
        val tenant = UUID.fromString(c.id)
        val marking = staffed(c)
        shift(marking, 40, 32)
        // Un padrón que rebasa el tope del cierre directo; el resto no marcó y se cierra en ceros.
        assertEquals(
            510,
            change(
                "insert into employee (tenant_id, id, external_id, display_name, status, employment_start, source) " +
                    "select ?, gen_random_uuid(), 'M-' || n, 'Persona ' || n, 'active', date '2026-01-05', 'manual' from generate_series(1, 510) n",
                tenant,
            ),
        )
        val direct = close(c)
        assertProblem(422, "validation", direct)
        assertEquals("too_many", direct.at("errors[0].code"))
        assertEquals(0, count("select count(*) from week_closure where tenant_id = ?", tenant))

        val id = request(c).at<String>("id")
        jobWorker.drain()
        val done = run(c, id)
        assertEquals("done", done.at("status"))
        assertEquals(listOf(511, 511, 0, 0), counts(done))
        assertEquals(511, count("select count(*) from week_closure where tenant_id = ? and status = 'closed'", tenant))
        assertEquals(1, count("select count(*) from week_closure where tenant_id = ? and worked_minutes = 480", tenant))
        assertEquals(1, count("select count(*) from job where reference_id = ? and status = 'done' and attempts = 1", UUID.fromString(id)))
    }

    @Test
    fun `a run interrupted halfway keeps what it closed, is retried and finishes, and one that cannot finish says so`() {
        val c = companyWithFinishedWeek()
        val tenant = UUID.fromString(c.id)
        val pending = staffed(c, newSite(c))
        val pendingIncident = marked(pending, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        marked(pending, before(32))
        val people = List(3) { staffed(c) }
        people.forEach { shift(it, 40, 32) }
        val id = request(c).at<String>("id")
        val runId = UUID.fromString(id)

        // La segunda persona no se puede cerrar: la base rechaza su cierre.
        asOwner(
            "create function it_fail_closure() returns trigger language plpgsql as \$\$ begin " +
                "if new.employee_id = '${people[1].employeeId}' then raise exception 'falla provocada'; end if; return new; end \$\$",
        )
        try {
            asOwner("create trigger it_fail_closure before insert on week_closure for each row execute function it_fail_closure()")
            assertEquals(1, jobWorker.drain(1))
            // La primera quedó cerrada aunque la corrida se interrumpió, y el trabajo espera otro intento.
            assertEquals(listOf(people[0].employeeId), closures(c).list("items[*].employeeId"))
            assertEquals(listOf("running", 4), listOf(run(c, id).at<String>("status"), run(c, id).at<Int>("total")))
            assertEquals(listOf(pending.employeeId), blocked(c, id).list("items[*].employeeId"))
            assertEquals(listOf(pendingIncident), blocked(c, id).list("items[0].incidentIds[*]"))
            assertEquals(1, count("select count(*) from job where reference_id = ? and status = 'queued' and attempts = 1 and last_error is not null", runId))
            assertEquals(0, count("select count(*) from job where reference_id = ? and last_error like '%provocada%'", runId))
        } finally {
            asOwner("drop trigger if exists it_fail_closure on week_closure")
            asOwner("drop function if exists it_fail_closure()")
        }
        val first = closures(c).at<String>("items[0].id")
        assertEquals(200, patch(c, pendingIncident, resolution("justified", "El supervisor confirmó la ubicación de la persona.")).status)
        // Pasa la pausa y el siguiente intento retoma donde quedó.
        assertEquals(1, change("update job set next_run_at = now() where reference_id = ?", runId))
        jobWorker.drain()
        val done = run(c, id)
        assertEquals("done", done.at("status"))
        assertEquals(listOf(4, 4, 0, 0), counts(done))
        assertEquals(0, blocked(c, id).at<Int>("items.length()"))
        assertEquals(4, count("select count(*) from week_closure where tenant_id = ?", tenant))
        assertEquals(1, closures(c).at<List<Any>>("items[?(@.id=='$first')]").size)
        assertEquals(1, count("select count(*) from job where reference_id = ? and status = 'done' and attempts = 2", runId))

        // El proceso que atendía otra corrida murió en su último intento: no se queda corriendo para siempre.
        val other = companyWithFinishedWeek()
        shift(staffed(other), 40, 32)
        val lost = request(other).at<String>("id")
        assertEquals(
            1,
            change(
                "update job set status = 'running', attempts = max_attempts, lease_until = now() - interval '1 second' where reference_id = ?",
                UUID.fromString(lost),
            ),
        )
        jobWorker.tick()
        val failed = run(other, lost)
        assertEquals(listOf("failed", "job_abandoned"), listOf<String>(failed.at("status"), failed.at("failure")))
        Instant.parse(failed.at("finishedAt"))
        // Una corrida fallida ya no está en curso: se puede pedir otra, y ésa sí termina.
        val again = request(other).at<String>("id")
        assertNotEquals(lost, again)
        jobWorker.drain()
        assertEquals(listOf(1, 1, 0, 0), counts(run(other, again)))
        val audit = call("GET", "/api/v1/audit-log?limit=200", other.adminToken)
        assertEquals(1, audit.at<List<Any>>("items[?(@.action=='week.closure_run_failed')]").size)
        assertEquals(listOf("job_abandoned"), audit.at<List<String>>("items[?(@.action=='week.closure_run_failed')].metadata.failure"))
    }

    @Test
    fun `a company that asks for it has its week closed by the system after the hours it chose, once a week`() {
        val c = companyWithFinishedWeek()
        val manual = companyWithFinishedWeek()
        val tenant = UUID.fromString(c.id)
        val ok = staffed(c)
        val unfinished = staffed(c)
        shift(ok, 40, 32)
        marked(unfinished, before(20))
        shift(staffed(manual), 40, 32)
        fun setting(body: String, token: String = c.adminToken) = call("PATCH", "/api/v1/tenant", token, body)
        fun runsOf(company: Company) = count("select count(*) from week_closure_run where tenant_id = ?", UUID.fromString(company.id))
        // La semana terminó a la medianoche de hoy, en la zona de la empresa.
        fun hoursAfterTheWeek(hours: Long) = midnight.plusSeconds(hours * 3600).atOffset(ZoneOffset.UTC)

        // Nace apagado: el sistema no cierra nada por su cuenta.
        assertNull(call("GET", "/api/v1/tenant", c.adminToken).at<Any?>("autoCloseAfterHours"))
        closureRuns.schedule(hoursAfterTheWeek(100))
        assertEquals(0, runsOf(c))
        // Sólo quien administra lo enciende, y dentro de un rango.
        for (bad in listOf("""{"autoCloseAfterHours":0}""", """{"autoCloseAfterHours":169}""", """{"autoCloseAfterHours":"mañana"}""")) {
            assertProblem(422, "validation", setting(bad))
        }
        assertProblem(403, "forbidden", setting("""{"autoCloseAfterHours":2}""", member(c, "rh").token))
        assertEquals(2, setting("""{"autoCloseAfterHours":2}""").at<Int>("autoCloseAfterHours"))
        // Cambiar otra cosa no lo apaga.
        assertEquals(2, setting("""{"name":"Empresa con cierre programado"}""").at<Int>("autoCloseAfterHours"))
        assertEquals(2, call("GET", "/api/v1/tenant", c.adminToken).at<Int>("autoCloseAfterHours"))

        // Antes del plazo no pasa nada.
        closureRuns.schedule(hoursAfterTheWeek(1))
        assertEquals(0, runsOf(c))
        // Cumplido el plazo abre una corrida de toda la empresa, y sólo una aunque se revise muchas veces.
        closureRuns.schedule(hoursAfterTheWeek(3))
        closureRuns.schedule(hoursAfterTheWeek(3))
        assertEquals(1, runsOf(c))
        // Quien no lo pidió sigue cerrando a mano.
        assertEquals(0, runsOf(manual))
        assertEquals(0, count("select count(*) from week_closure where tenant_id = ?", tenant))

        jobWorker.drain()
        val runs = call("GET", "/api/v1/week-closure-runs?week=$yesterday", c.adminToken)
        assertEquals(listOf("scheduled"), runs.list("items[*].origin"))
        assertEquals(listOf("done"), runs.list("items[*].status"))
        assertEquals(listOf(null), runs.at<List<Any?>>("items[*].requestedBy"))
        assertEquals(listOf(2, 1, 0, 1), listOf(runs.at<Int>("items[0].total"), runs.at<Int>("items[0].closed"), runs.at<Int>("items[0].blocked.openIncidents"), runs.at<Int>("items[0].blocked.openSegment")))
        // El cierre no tiene persona, y la bitácora se lo atribuye al sistema.
        assertEquals(listOf(ok.employeeId), closures(c).list("items[*].employeeId"))
        assertEquals(listOf(null), closures(c).at<List<Any?>>("items[*].closedBy"))
        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(listOf("system"), audit.at<List<String>>("items[?(@.action=='week.closed')].actor.type"))
        assertEquals(listOf("scheduled"), audit.at<List<String>>("items[?(@.action=='week.closure_run_finished')].metadata.origin"))
        assertEquals(listOf("system"), audit.at<List<String>>("items[?(@.action=='incident.opened')].actor.type"))

        // Pasa una vez por semana: a quien dejó sin cerrar lo cierra después una persona.
        closureRuns.schedule(hoursAfterTheWeek(30))
        jobWorker.drain()
        assertEquals(1, runsOf(c))
        assertEquals(1, count("select count(*) from week_closure where tenant_id = ?", tenant))
        // El trabajador ve y acusa un cierre que hizo el sistema igual que cualquier otro.
        val worker = linkedWorker(c, ok.employeeId)
        val own = closures(c).at<String>("items[0].id")
        assertNull(call("GET", "/api/v1/week-closures/$own", worker.token).at<Any?>("closedBy"))
        assertEquals(201, acknowledge(own, worker.token).status)

        // En nulo se apaga.
        assertNull(setting("""{"autoCloseAfterHours":null}""").at<Any?>("autoCloseAfterHours"))

        // Una empresa suspendida no se cierra sola; reactivada, sí.
        val paused = companyWithFinishedWeek()
        shift(staffed(paused), 40, 32)
        assertEquals(1, call("PATCH", "/api/v1/tenant", paused.adminToken, """{"autoCloseAfterHours":1}""").at<Int>("autoCloseAfterHours"))
        assertEquals(200, call("POST", "/api/v1/tenants/${paused.id}/suspension", operator, """{"reason":"Suspendida para la prueba."}""").status)
        closureRuns.schedule(hoursAfterTheWeek(3))
        assertEquals(0, runsOf(paused))
        assertEquals(200, call("POST", "/api/v1/tenants/${paused.id}/reactivation", operator, """{"reason":"Reactivada para la prueba."}""").status)
        closureRuns.schedule(hoursAfterTheWeek(3))
        assertEquals(1, runsOf(paused))
        // Y una corrida que quedó pendiente al suspenderla termina como fallida, sin cerrar a nadie.
        assertEquals(200, call("POST", "/api/v1/tenants/${paused.id}/suspension", operator, """{"reason":"Suspendida otra vez."}""").status)
        jobWorker.drain()
        assertEquals(1, count("select count(*) from week_closure_run where tenant_id = ? and status = 'failed' and failure = 'tenant_not_active'", UUID.fromString(paused.id)))
        assertEquals(0, count("select count(*) from week_closure where tenant_id = ?", UUID.fromString(paused.id)))
    }

    @Test
    fun `closure runs admit only the roles the contract gives them and belong to one company`() {
        val a = companyWithFinishedWeek()
        val b = companyWithFinishedWeek()
        val mine = staffed(a)
        shift(mine, 40, 32)
        val runOfA = request(a).at<String>("id")
        jobWorker.drain()
        val people = linkedMapOf(
            "admin_empresa" to a.adminToken,
            "rh" to member(a, "rh").token,
            "supervisor" to member(a, "supervisor").token,
            "auditor" to member(a, "auditor").token,
            "trabajador" to linkedWorker(a, mine.employeeId).token,
        )
        val staff = arrayOf("admin_empresa", "rh", "supervisor", "auditor")

        class Route(val method: String, val path: String, val body: String?, vararg val allowed: String)
        val routes = listOf(
            Route("POST", "/api/v1/week-closure-runs", wholeWeek(), "admin_empresa", "rh"),
            Route("GET", "/api/v1/week-closure-runs", null, *staff),
            Route("GET", "/api/v1/week-closure-runs/$runOfA", null, *staff),
            Route("GET", "/api/v1/week-closure-runs/$runOfA/blocked", null, *staff),
            // Lo que el contrato no abre sigue cerrado, también para quien administra.
            Route("DELETE", "/api/v1/week-closure-runs/$runOfA", null),
            Route("PATCH", "/api/v1/week-closure-runs/$runOfA", "{}"),
            Route("POST", "/api/v1/week-closure-runs/$runOfA/cancel", "{}"),
        )
        for (route in routes) {
            assertProblem(401, "unauthorized", call(route.method, route.path, null, route.body))
            for ((role, token) in people) {
                val reply = call(route.method, route.path, token, route.body)
                if (role in route.allowed) {
                    assertTrue(reply.status in 200..299, "$role ${route.method} ${route.path}: $reply")
                } else {
                    assertProblem(403, "forbidden", reply)
                }
            }
        }
        // La credencial de un dispositivo no entra a las corridas.
        assertProblem(401, "unauthorized", call("GET", "/api/v1/week-closure-runs/$runOfA", assertion(mine.phone)))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/week-closure-runs/$runOfA/blocked", assertion(mine.phone)))
        assertProblem(401, "unauthorized", call("POST", "/api/v1/week-closure-runs", assertion(mine.phone), wholeWeek()))
        jobWorker.drain()

        // Para la otra empresa, la corrida no existe, y no puede limitar la suya a una sede ajena.
        assertProblem(404, "not_found", run(b, runOfA))
        assertProblem(404, "not_found", blocked(b, runOfA))
        assertProblem(404, "not_found", blocked(a, UUID.randomUUID().toString()))
        assertProblem(404, "not_found", run(a, UUID.randomUUID().toString()))
        assertProblem(404, "not_found", run(a, "no-es-un-identificador"))
        assertEquals(0, call("GET", "/api/v1/week-closure-runs", b.adminToken).at<Int>("items.length()"))
        assertProblem(422, "validation", request(b, """{"weekStart":"$yesterday","siteId":"${newSite(a)}"}"""))
        assertEquals(202, request(b).status)
        jobWorker.drain()
        assertEquals(1, call("GET", "/api/v1/week-closure-runs", b.adminToken).at<Int>("items.length()"))
        assertFalse(runOfA in call("GET", "/api/v1/week-closure-runs", b.adminToken).body)
        assertFalse(runOfA in call("GET", "/api/v1/audit-log?limit=200", b.adminToken).body)

        // Una tercera corrida, para tener qué recorrer.
        assertEquals(202, request(a).status)
        jobWorker.drain()

        // La lista se filtra por semana y se recorre por páginas.
        fun list(query: String) = call("GET", "/api/v1/week-closure-runs$query", a.adminToken)
        val all = list("").list("items[*].id")
        assertEquals(3, all.size)
        assertEquals(runOfA, all.first())
        assertEquals(all, list("?week=$lastWeek").list("items[*].id"))
        assertEquals(0, list("?week=${today.minusDays(30)}").at<Int>("items.length()"))
        for (bad in listOf("?week=ayer", "?limit=0", "?cursor=x")) assertProblem(422, "validation", list(bad))
        val page = list("?limit=2")
        val rest = list("?limit=2&cursor=${page.at<String>("nextCursor")}")
        assertEquals(all, page.list("items[*].id") + rest.list("items[*].id"))
        assertNull(rest.at<Any?>("nextCursor"))
    }
}
