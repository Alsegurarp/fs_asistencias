package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import org.springframework.test.context.TestPropertySource
import java.sql.DriverManager
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Jornada, incidencias y cierre semanal, con dos empresas. */
@Tag("integration")
class WorkdayIT : WorkdayTestBase() {

    @Test
    fun `every workday route asks for a credential and admits only the roles the contract gives it`() {
        val c = companyWithFinishedWeek()
        val siteId = newSite(c)
        val mine = staffed(c, siteId)
        val flagged = staffed(c, siteId)
        shift(mine, 40, 32)
        val incidentId = marked(flagged, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        val people = linkedMapOf(
            "admin_empresa" to c.adminToken,
            "rh" to member(c, "rh").token,
            "supervisor" to member(c, "supervisor").token,
            "auditor" to member(c, "auditor").token,
            "trabajador" to linkedWorker(c, mine.employeeId).token,
        )
        val closureId = closureOf(close(c, listOf(mine.employeeId)), mine.employeeId)["id"] as String
        val staff = arrayOf("admin_empresa", "rh", "supervisor", "auditor")
        val closing = json(mapOf("weekStart" to yesterday.toString(), "employeeIds" to listOf(mine.employeeId)))

        class Route(val method: String, val path: String, val body: String?, vararg val allowed: String)
        val routes = listOf(
            Route("GET", "/api/v1/employees/${mine.employeeId}/attendance?week=$yesterday", null, *staff),
            Route("GET", "/api/v1/me/attendance?week=$yesterday", null, "trabajador"),
            Route("GET", "/api/v1/incidents", null, *staff),
            Route("GET", "/api/v1/incidents/$incidentId", null, *staff),
            Route("PATCH", "/api/v1/incidents/$incidentId", """{"assigneeUserId":null}""", "admin_empresa", "rh", "supervisor"),
            Route("GET", "/api/v1/week-closures?week=$yesterday", null, *staff),
            Route("POST", "/api/v1/week-closures", closing, "admin_empresa", "rh"),
            Route("GET", "/api/v1/week-closures/$closureId", null, *staff, "trabajador"),
            Route("GET", "/api/v1/rule-sets", null, *staff),
            Route("POST", "/api/v1/week-closures/$closureId/acknowledgements", """{"type":"agreed"}""", "trabajador"),
            // Al final, porque reabrir cambia el cierre.
            Route("POST", "/api/v1/week-closures/$closureId/reopen", """{"reason":"Se revisa de nuevo la semana."}""", "admin_empresa"),
            // Lo que el contrato no abre sigue cerrado, también para quien administra.
            Route("DELETE", "/api/v1/incidents/$incidentId", null),
            Route("DELETE", "/api/v1/week-closures/$closureId", null),
            Route("PUT", "/api/v1/rule-sets", "{}"),
            Route("GET", "/api/v1/jobs", null),
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
    }

    @Test
    fun `the week adds up what was marked, in the order it happened`() {
        val c = companyWithFinishedWeek()
        val siteId = newSite(c)
        val one = staffed(c, siteId)
        val entry = marked(one, before(40))
        val exit = marked(one, before(32))
        shift(one, 16, 11)
        marked(one, before(10, 30), declared = "clock_in")
        marked(one, before(10))

        val view = week(c, one.employeeId)
        assertEquals(listOf(480, 300, 30), minutes(view))
        assertEquals(listOf("work", "work", "work"), view.list("segments[*].kind"))
        assertEquals(listOf(one.employeeId, lastWeek.toString(), "America/Mexico_City"), listOf(view.at("employeeId"), view.at<String>("weekStart"), view.at<String>("timeZone")))
        assertEquals(listOf(entry.at<String>("eventId"), exit.at<String>("eventId")), listOf(view.at("segments[0].startEventId"), view.at<String>("segments[0].endEventId")))
        assertEquals(listOf(before(40).toString(), before(32).toString()), listOf(view.at("segments[0].startAt"), view.at<String>("segments[0].endAt")))
        assertEquals(mapOf("workedMinutes" to 810, "breakMinutes" to 0, "ordinaryMinutes" to 810, "overtimeMinutes" to 0), view.at<Map<String, Int>>("totals"))
        assertEquals(listOf(1, 1, 1), view.at<List<Int>>("segments[*].version"))
        assertTrue(view.list("alerts").isEmpty() && view.list("openIncidentIds").isEmpty())
        assertNull(view.at<Any?>("closure"))
        // Las reglas son las vigentes en el último día de esa semana.
        val rules = call("GET", "/api/v1/rule-sets?effectiveOn=$yesterday", c.adminToken)
        assertEquals(rules.at<String>("items[0].id"), view.at("ruleSet.id"))

        // Cualquier fecha de la semana da la misma; la de hoy ya es otra semana.
        assertEquals(view.body, call("GET", "/api/v1/employees/${one.employeeId}/attendance?week=$lastWeek", c.adminToken).body)
        val current = call("GET", "/api/v1/employees/${one.employeeId}/attendance?week=$today", c.adminToken)
        assertEquals(listOf(today.toString(), 0), listOf(current.at<String>("weekStart"), current.at<Int>("segments.length()")))
        assertProblem(422, "validation", call("GET", "/api/v1/employees/${one.employeeId}/attendance", c.adminToken))
        assertProblem(422, "validation", call("GET", "/api/v1/employees/${one.employeeId}/attendance?week=ayer", c.adminToken))
        assertProblem(404, "not_found", week(c, UUID.randomUUID().toString()))
        assertProblem(404, "not_found", week(c, "no-es-un-identificador"))

        // Un turno que se sincroniza al revés: primero llega la salida y después la entrada.
        val late = staffed(c, siteId)
        val arrivedFirst = marked(late, before(32))
        val arrivedSecond = marked(late, before(40))
        // Al recibirlas, las dos parecían entradas, y así quedaron guardadas.
        assertEquals(listOf("clock_in", "clock_in"), listOf(arrivedFirst.at("type"), arrivedSecond.at<String>("type")))
        // La semana las vuelve a leer en el orden en que ocurrieron.
        val reordered = week(c, late.employeeId)
        assertEquals(listOf(480), minutes(reordered))
        assertEquals(arrivedSecond.at<String>("eventId"), reordered.at("segments[0].startEventId"))
        assertTrue(reordered.list("alerts").isEmpty())

        // Dos lecturas seguidas son una sola marca y no parten el turno.
        val twice = staffed(c)
        marked(twice, before(40))
        val repeated = marked(twice, before(39, 59))
        marked(twice, before(32))
        assertEquals("duplicate", repeated.at("incident.type"))
        assertEquals(listOf(480), minutes(week(c, twice.employeeId)))

        // Donde la comida se marca, el descanso se mide y no cuenta como trabajo.
        val withBreaks = companyWithFinishedWeek("marked")
        val eater = staffed(withBreaks)
        for (at in listOf(before(20), before(16), before(15, 15), before(11))) marked(eater, at)
        val measured = week(withBreaks, eater.employeeId)
        assertEquals(listOf(240, 45, 255), minutes(measured))
        assertEquals(listOf("work", "break", "work"), measured.list("segments[*].kind"))
        assertEquals(listOf(495, 45), listOf(measured.at("totals.workedMinutes"), measured.at<Int>("totals.breakMinutes")))
    }

    @Test
    fun `a worker sees their own week with their account or their phone, and nobody else's`() {
        val c = companyWithFinishedWeek()
        val other = companyWithFinishedWeek()
        val siteId = newSite(c)
        val mine = staffed(c, siteId)
        val colleague = staffed(c, siteId)
        shift(mine, 40, 32)
        shift(colleague, 40, 30)
        val worker = linkedWorker(c, mine.employeeId)
        val unlinked = member(c, "trabajador")
        val terminal = terminal(c, siteId)
        fun myWeek(token: String?) = call("GET", "/api/v1/me/attendance?week=$yesterday", token)

        val expected = week(c, mine.employeeId)
        assertEquals(listOf(480), minutes(expected))
        // Con su cuenta y con su teléfono ve exactamente lo mismo que ve la empresa de él.
        assertEquals(expected.body, myWeek(worker.token).body)
        assertEquals(expected.body, myWeek(assertion(mine.phone)).body)
        assertEquals(mine.employeeId, call("GET", "/api/v1/me", worker.token).at("employeeId"))
        assertEquals(listOf(600), minutes(myWeek(assertion(colleague.phone))))

        // Sin fila del padrón no hay nada suyo que ver; una terminal no es de nadie.
        assertProblem(403, "forbidden", myWeek(unlinked.token))
        assertProblem(403, "forbidden", myWeek(assertion(terminal)))
        assertProblem(403, "forbidden", myWeek(c.adminToken))
        assertProblem(401, "unauthorized", myWeek(assertion(mine.phone, audience = "otra-audiencia")))
        assertProblem(401, "unauthorized", myWeek(assertion(mine.phone, signer = newKey())))
        assertProblem(422, "validation", call("GET", "/api/v1/me/attendance", worker.token))
        // La semana de otra persona no es del trabajador, ni con su cuenta ni con su teléfono.
        assertProblem(403, "forbidden", week(c, colleague.employeeId, worker.token))
        assertProblem(401, "unauthorized", week(c, mine.employeeId, assertion(mine.phone)))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/incidents", assertion(mine.phone)))

        // La liga entre cuenta y padrón: una fila, una cuenta, y de la misma empresa.
        val foreign = newEmployee(other)
        fun link(userId: String, employeeId: String?) =
            call("PATCH", "/api/v1/users/$userId", c.adminToken, json(mapOf("employeeId" to employeeId)))
        assertProblem(409, "employee_already_linked", link(unlinked.id, mine.employeeId))
        assertProblem(422, "validation", link(unlinked.id, foreign))
        assertProblem(422, "validation", link(unlinked.id, UUID.randomUUID().toString()))
        assertProblem(422, "validation", link(unlinked.id, "no-es-un-identificador"))
        assertEquals(colleague.employeeId, link(unlinked.id, colleague.employeeId).at("employeeId"))
        assertEquals(listOf(600), minutes(myWeek(unlinked.token)))
        // Soltarla es mandar nulo; no mandarla no cambia nada.
        assertEquals(colleague.employeeId, call("PATCH", "/api/v1/users/${unlinked.id}", c.adminToken, """{"displayName":"Otra persona"}""").at("employeeId"))
        assertNull(link(unlinked.id, null).at<Any?>("employeeId"))
        assertProblem(403, "forbidden", myWeek(unlinked.token))
        // También se puede ligar desde la invitación.
        val invited = call(
            "POST", "/api/v1/users", c.adminToken,
            """{"email":"${email("ligada")}","roles":["trabajador"],"employeeId":"${colleague.employeeId}"}""",
        )
        assertEquals(listOf(201, colleague.employeeId), listOf(invited.status, invited.at<String>("employeeId")))
        assertProblem(
            409, "employee_already_linked",
            call("POST", "/api/v1/users", c.adminToken, """{"email":"${email("repetida")}","roles":["trabajador"],"employeeId":"${mine.employeeId}"}"""),
        )
        assertProblem(
            422, "validation",
            call("POST", "/api/v1/users", c.adminToken, """{"email":"${email("ajena")}","roles":["trabajador"],"employeeId":"$foreign"}"""),
        )
    }

    @Test
    fun `an incident is assigned and resolved with a reason, and an adjustment changes the week without touching the marks`() {
        val c = companyWithFinishedWeek()
        val other = company()
        val siteId = newSite(c)
        val one = staffed(c, siteId)
        val two = staffed(c)
        val supervisor = member(c, "supervisor")
        // Entra fuera de la sede y sale bien; vuelve a entrar sin ubicación y no marca la salida.
        val outside = marked(one, before(40), location = here(latitude = 19.44))
        marked(one, before(32))
        val unlocated = marked(one, before(15), location = null)
        val first = outside.at<String>("incident.id")
        val second = unlocated.at<String>("incident.id")
        assertEquals(listOf("foreign_site", "location_inconclusive"), listOf(outside.at("incident.type"), unlocated.at<String>("incident.type")))
        // Otra persona declara una salida cuando le tocaba entrar.
        val wrong = marked(two, before(40), declared = "clock_out")
        marked(two, before(32))
        val third = wrong.at<String>("incident.id")
        assertEquals("missing_pair", wrong.at("incident.type"))
        fun incidents(query: String = "") = call("GET", "/api/v1/incidents$query", c.adminToken)

        assertEquals(listOf(first, second, third), incidents("?status=open").list("items[*].id"))
        assertEquals(listOf("medium", "medium", "medium"), incidents().list("items[*].severity"))
        assertEquals(listOf(first), incidents("?type=foreign_site").list("items[*].id"))
        assertEquals(listOf(first, second), incidents("?siteId=$siteId&week=$yesterday").list("items[*].id"))
        assertEquals(0, incidents("?week=${today.minusDays(30)}").at<Int>("items.length()"))
        assertEquals(0, incidents("?siteId=${newSite(c)}").at<Int>("items.length()"))
        assertEquals(0, incidents("?status=resolved").at<Int>("items.length()"))
        for (bad in listOf("?status=cerrada", "?type=otra", "?siteId=x", "?week=ayer", "?limit=0")) {
            assertProblem(422, "validation", incidents(bad))
        }
        val page = incidents("?limit=2")
        assertEquals(listOf(first, second), page.list("items[*].id"))
        val rest = incidents("?limit=2&cursor=${page.at<String>("nextCursor")}")
        assertEquals(listOf(third), rest.list("items[*].id"))
        assertNull(rest.at<Any?>("nextCursor"))

        val detail = incidents("/$first")
        assertEquals(
            listOf("foreign_site", "medium", "open", one.employeeId, siteId),
            listOf<String>(detail.at("type"), detail.at("severity"), detail.at("status"), detail.at("employeeId"), detail.at("siteId")),
        )
        assertEquals(listOf(outside.at<String>("eventId")), detail.list("eventIds"))
        assertNull(detail.at<Any?>("assigneeUserId"))
        assertNull(detail.at<Any?>("resolution"))
        assertProblem(404, "not_found", incidents("/${UUID.randomUUID()}"))
        assertProblem(404, "not_found", incidents("/no-es-un-identificador"))

        val pending = week(c, one.employeeId)
        assertEquals(listOf(480, 0), minutes(pending))
        assertEquals(listOf("open_segment"), pending.list("alerts[*].code"))
        assertEquals(listOf(first, second), pending.list("openIncidentIds"))

        // Asignar: a alguien con acceso vigente a esta empresa, o a nadie.
        assertEquals(supervisor.id, patch(c, first, """{"assigneeUserId":"${supervisor.id}"}""").at("assigneeUserId"))
        for (bad in listOf(
            """{"assigneeUserId":"${UUID.randomUUID()}"}""", """{"assigneeUserId":"${other.adminId}"}""", """{"assigneeUserId":7}""",
            "{}", """{"severity":"low"}""", """{"status":"resolved"}""",
        )) {
            assertProblem(422, "validation", patch(c, first, bad))
        }
        assertEquals(supervisor.id, incidents("/$first").at("assigneeUserId"))
        assertNull(patch(c, first, """{"assigneeUserId":null}""").at<Any?>("assigneeUserId"))

        // Resolver exige decisión y motivo, y cada clase de ajuste trae lo suyo y nada más.
        val reason = "Entró por la puerta de la otra calle; lo confirma su supervisor."
        val eventOfOne = outside.at<String>("eventId")
        val eventOfTwo = wrong.at<String>("eventId")
        for (bad in listOf(
            """{"resolution":"justified"}""",
            """{"resolution":{"decision":"justified"}}""",
            """{"resolution":{"decision":"justified","reason":"corto"}}""",
            json(mapOf("resolution" to mapOf("decision" to "justified", "reason" to "x".repeat(501)))),
            resolution("perdonada", reason),
            resolution("adjusted", reason),
            json(mapOf("resolution" to mapOf("decision" to "justified", "reason" to reason, "nota" to "x"))),
            resolution("justified", reason, mapOf("kind" to "exclude_event", "eventId" to eventOfOne)),
            resolution("adjusted", reason, mapOf("kind" to "borrar", "eventId" to eventOfOne)),
            resolution("adjusted", reason, mapOf("kind" to "add_event", "eventType" to "clock_out")),
            resolution("adjusted", reason, mapOf("kind" to "add_event", "occurredAt" to before(8).toString())),
            resolution("adjusted", reason, mapOf("kind" to "add_event", "eventType" to "clock_out", "occurredAt" to "ayer")),
            resolution("adjusted", reason, mapOf("kind" to "add_event", "eventType" to "clock_out", "occurredAt" to before(8).toString(), "eventId" to eventOfOne)),
            resolution("adjusted", reason, mapOf("kind" to "exclude_event")),
            resolution("adjusted", reason, mapOf("kind" to "exclude_event", "eventId" to eventOfOne, "eventType" to "clock_in")),
            resolution("adjusted", reason, mapOf("kind" to "exclude_event", "eventId" to eventOfOne, "occurredAt" to before(8).toString())),
            resolution("adjusted", reason, mapOf("kind" to "retype_event", "eventId" to eventOfOne)),
            resolution("adjusted", reason, mapOf("kind" to "retype_event", "eventId" to eventOfOne, "eventType" to "comida")),
            // El marcaje tiene que existir y ser de esa misma persona.
            resolution("adjusted", reason, mapOf("kind" to "exclude_event", "eventId" to UUID.randomUUID().toString())),
            resolution("adjusted", reason, mapOf("kind" to "exclude_event", "eventId" to eventOfTwo)),
        )) {
            assertProblem(422, "validation", patch(c, first, bad))
        }
        assertEquals("open", incidents("/$first").at("status"))
        assertEquals(0, count("select count(*) from adjustment where tenant_id = ?", UUID.fromString(c.id)))

        // Justificar: queda resuelta, con quién y por qué, y la jornada no cambia.
        val justified = patch(c, first, resolution("justified", reason), supervisor.token)
        assertEquals(200, justified.status, justified.toString())
        assertEquals(
            listOf("resolved", "justified", reason, supervisor.id),
            listOf<String>(justified.at("status"), justified.at("resolution.decision"), justified.at("resolution.reason"), justified.at("resolution.resolvedBy")),
        )
        assertNull(justified.at<Any?>("resolution.adjustment"))
        Instant.parse(justified.at("resolution.resolvedAt"))
        assertEquals(listOf(480, 0), minutes(week(c, one.employeeId)))
        // Lo resuelto ya no se reasigna ni se vuelve a resolver.
        assertProblem(409, "incident_already_resolved", patch(c, first, """{"assigneeUserId":null}"""))
        assertProblem(409, "incident_already_resolved", patch(c, first, resolution("confirmed", reason)))
        assertEquals(listOf(first), incidents("?status=resolved").list("items[*].id"))

        // Ajustar agregando la salida que faltó.
        val added = patch(
            c, second,
            resolution("adjusted", "Olvidó marcar la salida; la confirma su supervisor.", mapOf("kind" to "add_event", "eventType" to "clock_out", "occurredAt" to before(7).toString())),
        )
        assertEquals(200, added.status, added.toString())
        assertEquals(
            mapOf("kind" to "add_event", "eventType" to "clock_out", "occurredAt" to before(7).toString()),
            added.at<Map<String, Any?>>("resolution.adjustment"),
        )
        val corrected = week(c, one.employeeId)
        assertEquals(listOf(480, 480), minutes(corrected))
        assertEquals(listOf(2, 2), corrected.at<List<Int>>("segments[*].version"))
        assertEquals(960, corrected.at<Int>("totals.workedMinutes"))
        assertTrue(corrected.list("alerts").isEmpty() && corrected.list("openIncidentIds").isEmpty())

        // Ajustar cambiando el tipo: la que se declaró salida era la entrada.
        assertEquals(listOf(0), minutes(week(c, two.employeeId)))
        val retyped = patch(c, third, resolution("adjusted", "Se equivocó de botón al llegar.", mapOf("kind" to "retype_event", "eventId" to eventOfTwo, "eventType" to "clock_in")))
        assertEquals(mapOf("kind" to "retype_event", "eventId" to eventOfTwo, "eventType" to "clock_in"), retyped.at<Map<String, Any?>>("resolution.adjustment"))
        assertEquals(listOf(480), minutes(week(c, two.employeeId)))

        // Los marcajes siguen como se recibieron: mismos, con su tipo original.
        val events = call("GET", "/api/v1/attendance-events?from=${before(72)}&to=${Instant.now()}", c.adminToken)
        assertEquals(5, events.at<Int>("items.length()"))
        assertEquals(listOf("clock_out"), events.at<List<String>>("items[?(@.id=='$eventOfTwo')].type"))
        assertEquals(2, count("select count(*) from adjustment where tenant_id = ?", UUID.fromString(c.id)))

        // Queda en la bitácora quién decidió qué; el motivo vive en la incidencia.
        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(3, audit.at<List<Any>>("items[?(@.action=='incident.resolved')]").size)
        assertEquals(2, audit.at<List<Any>>("items[?(@.action=='incident.assigned')]").size)
        assertFalse(reason in audit.body)
    }

    @Test
    fun `closing freezes the week, skips whoever has something pending, and reopening keeps the closed version`() {
        val c = companyWithFinishedWeek()
        val siteId = newSite(c)
        val rh = member(c, "rh")
        val ok = staffed(c, siteId)
        val pending = staffed(c, siteId)
        val unfinished = staffed(c, siteId)
        val idle = newEmployee(c, siteId)
        shift(ok, 40, 32)
        val incidentId = marked(pending, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        marked(pending, before(32))
        val entryOfUnfinished = marked(unfinished, before(20)).at<String>("eventId")

        // La semana en curso todavía puede recibir marcajes.
        val early = close(c, week = today)
        assertProblem(422, "validation", early)
        assertEquals("week_not_finished", early.at("errors[0].code"))
        for (bad in listOf(
            "{}", """{"weekStart":"ayer"}""", """{"weekStart":"$yesterday","todos":true}""",
            """{"weekStart":"$yesterday","siteId":"${UUID.randomUUID()}"}""",
            """{"weekStart":"$yesterday","employeeIds":["${UUID.randomUUID()}"]}""",
            """{"weekStart":"$yesterday","employeeIds":["x"]}""",
            json(mapOf("weekStart" to yesterday.toString(), "employeeIds" to List(501) { UUID.randomUUID().toString() })),
        )) {
            assertProblem(422, "validation", call("POST", "/api/v1/week-closures", c.adminToken, bad))
        }
        assertEquals(0, count("select count(*) from week_closure where tenant_id = ?", UUID.fromString(c.id)))

        val result = close(c, token = rh.token)
        assertEquals(201, result.status, result.toString())
        assertEquals(lastWeek.toString(), result.at("weekStart"))
        // Quien no marcó se cierra en ceros; quien tiene algo pendiente no se cierra.
        assertEquals(setOf(ok.employeeId, idle), result.list("closed[*].employeeId").toSet())
        assertEquals(
            mapOf(pending.employeeId to "open_incidents", unfinished.employeeId to "open_segment"),
            result.list("blocked[*].employeeId").zip(result.list("blocked[*].reason")).toMap(),
        )
        assertEquals(listOf(incidentId), result.at<List<String>>("blocked[?(@.employeeId=='${pending.employeeId}')].incidentIds[*]"))
        // Un tramo sin cerrar que nadie ha visto no tendría con qué corregirse: el cierre le abre una incidencia.
        val ofUnfinished = "blocked[?(@.employeeId=='${unfinished.employeeId}')]"
        val forgotten = result.at<List<String>>("$ofUnfinished.incidentIds[*]").single()
        val opened = call("GET", "/api/v1/incidents/$forgotten", c.adminToken)
        assertEquals(
            listOf("missing_pair", "medium", "open", unfinished.employeeId),
            listOf<String>(opened.at("type"), opened.at("severity"), opened.at("status"), opened.at("employeeId")),
        )
        assertEquals(listOf(entryOfUnfinished), opened.list("eventIds"))
        val closure = closureOf(result, ok.employeeId)
        val closureId = closure["id"] as String
        assertEquals(listOf(1, "closed", rh.id, lastWeek.toString(), null), listOf(closure["version"], closure["status"], closure["closedBy"], closure["weekStart"], closure["acknowledgement"]))
        assertEquals(mapOf("workedMinutes" to 480, "breakMinutes" to 0, "ordinaryMinutes" to 480, "overtimeMinutes" to 0), closure["totals"])
        assertTrue(sha256.matches(closure["hash"] as String))
        assertEquals(call("GET", "/api/v1/rule-sets?effectiveOn=$yesterday", c.adminToken).at<String>("items[0].id"), (closure["ruleSet"] as Map<*, *>)["id"])
        assertEquals(0, (closureOf(result, idle)["totals"] as Map<*, *>)["workedMinutes"])
        // La huella es la del cálculo guardado: se puede volver a calcular.
        val verifiable = "select count(*) from week_closure where tenant_id = ? and hash = encode(sha256(convert_to(cast(snapshot as text), 'UTF8')), 'hex')"
        assertEquals(2, count(verifiable, UUID.fromString(c.id)))

        // Cerrar otra vez no crea nada: devuelve los mismos cierres y no abre otra incidencia.
        val again = close(c)
        assertEquals(result.list("closed[*].id").toSet(), again.list("closed[*].id").toSet())
        assertEquals(2, count("select count(*) from week_closure where tenant_id = ?", UUID.fromString(c.id)))
        assertEquals(listOf("open_incidents"), again.list("$ofUnfinished.reason"))
        assertEquals(listOf(forgotten), again.list("$ofUnfinished.incidentIds[*]"))
        assertEquals(
            1,
            count("select count(*) from incident where tenant_id = ? and employee_id = ?", UUID.fromString(c.id), UUID.fromString(unfinished.employeeId)),
        )
        // Una sede sin gente no cierra a nadie.
        val empty = call("POST", "/api/v1/week-closures", c.adminToken, """{"weekStart":"$yesterday","siteId":"${newSite(c)}"}""")
        assertEquals(listOf(201, 0, 0), listOf(empty.status, empty.at<Int>("closed.length()"), empty.at<Int>("blocked.length()")))

        fun closures(query: String) = call("GET", "/api/v1/week-closures$query", c.adminToken)
        assertEquals(result.list("closed[*].id").toSet(), closures("?week=$yesterday").list("items[*].id").toSet())
        assertEquals(listOf(closureId), closures("?week=$lastWeek&employeeId=${ok.employeeId}").list("items[*].id"))
        assertEquals(0, closures("?week=$today").at<Int>("items.length()"))
        for (bad in listOf("", "?week=ayer", "?week=$yesterday&employeeId=x")) assertProblem(422, "validation", closures(bad))
        val page = closures("?week=$yesterday&limit=1")
        val next = closures("?week=$yesterday&limit=1&cursor=${page.at<String>("nextCursor")}")
        assertEquals(result.list("closed[*].id").toSet(), (page.list("items[*].id") + next.list("items[*].id")).toSet())
        assertNull(next.at<Any?>("nextCursor"))
        assertEquals(closure, closures("/$closureId").whole())
        assertProblem(404, "not_found", closures("/${UUID.randomUUID()}"))

        // La semana cerrada se entrega tal como se congeló.
        val live = week(c, unfinished.employeeId)
        val frozen = week(c, ok.employeeId)
        assertEquals(mapOf("id" to closureId, "version" to 1, "status" to "closed"), frozen.at<Map<String, Any?>>("closure"))
        assertEquals(listOf(480), minutes(frozen))
        assertNull(live.at<Any?>("closure"))

        // Un marcaje que llega después del cierre se guarda, pero el cierre no cambia solo.
        val late = marked(ok, before(5))
        assertEquals(listOf("accepted_with_incident", "late_sync"), listOf(late.at("outcome"), late.at<String>("incident.type")))
        val lateIncident = late.at<String>("incident.id")
        val still = week(c, ok.employeeId)
        assertEquals(listOf(480), minutes(still))
        assertEquals(frozen.at<Any>("segments"), still.at<Any>("segments"))
        assertEquals(frozen.at<Any>("totals"), still.at<Any>("totals"))
        assertEquals(listOf(lateIncident), still.list("openIncidentIds"))
        // A quien no está cerrado, la misma marca no le abre nada.
        assertEquals("accepted", marked(pending, before(5)).at("outcome"))

        // Una semana cerrada no se ajusta: primero se reabre.
        val exclusion = resolution("adjusted", "Lectura hecha por error al pasar.", mapOf("kind" to "exclude_event", "eventId" to late.at<String>("eventId")))
        assertProblem(409, "week_closed", patch(c, lateIncident, exclusion))
        val addition = resolution("adjusted", "Lectura hecha por error al pasar.", mapOf("kind" to "add_event", "eventType" to "clock_out", "occurredAt" to before(4).toString()))
        assertProblem(409, "week_closed", patch(c, lateIncident, addition))
        assertEquals("open", call("GET", "/api/v1/incidents/$lateIncident", c.adminToken).at("status"))
        assertEquals(0, count("select count(*) from adjustment where tenant_id = ?", UUID.fromString(c.id)))

        // Reabrir: sólo quien administra, con motivo, y una vez.
        assertProblem(403, "forbidden", reopen(closureId, rh.token))
        assertProblem(422, "validation", reopen(closureId, c.adminToken, "corto"))
        assertProblem(422, "validation", call("POST", "/api/v1/week-closures/$closureId/reopen", c.adminToken, "{}"))
        assertProblem(404, "not_found", reopen(UUID.randomUUID().toString(), c.adminToken))
        assertEquals("closed", closures("/$closureId").at("status"))
        val reopened = reopen(closureId, c.adminToken)
        assertEquals(listOf(200, "reopened", 1, closure["hash"]), listOf(reopened.status, reopened.at<String>("status"), reopened.at<Int>("version"), reopened.at<String>("hash")))
        assertProblem(409, "closure_not_closed", reopen(closureId, c.adminToken))

        // Reabierta, la semana se vuelve a calcular con lo que hay ahora.
        val recalculated = week(c, ok.employeeId)
        assertEquals(listOf(480, 0), minutes(recalculated))
        assertEquals(mapOf("id" to closureId, "version" to 1, "status" to "reopened"), recalculated.at<Map<String, Any?>>("closure"))
        // Y no se vuelve a cerrar mientras tenga algo pendiente.
        val blocked = close(c, listOf(ok.employeeId))
        assertEquals(listOf(0, "open_incidents"), listOf(blocked.at<Int>("closed.length()"), blocked.at<String>("blocked[0].reason")))
        assertEquals(200, patch(c, lateIncident, exclusion).status)
        assertEquals(listOf(480), minutes(week(c, ok.employeeId)))

        // Volver a cerrar crea una versión nueva; la anterior queda como estaba.
        val second = closureOf(close(c, listOf(ok.employeeId)), ok.employeeId)
        assertEquals(listOf(2, "closed"), listOf(second["version"], second["status"]))
        assertNotEquals(closureId, second["id"])
        assertNotEquals(closure["hash"], second["hash"])
        assertEquals(480, (second["totals"] as Map<*, *>)["workedMinutes"])
        val history = closures("?week=$yesterday&employeeId=${ok.employeeId}")
        assertEquals(listOf(1 to "reopened", 2 to "closed"), history.at<List<Int>>("items[*].version").zip(history.list("items[*].status")))
        assertEquals(closure["hash"], closures("/$closureId").at("hash"))
        assertEquals(3, count(verifiable, UUID.fromString(c.id)))

        // A quien se le agrega la salida que faltó entra al siguiente cierre; quien sigue con incidencia, no.
        val exit = resolution(
            "adjusted", "Olvidó marcar la salida; la confirma su supervisor.",
            mapOf("kind" to "add_event", "eventType" to "clock_out", "occurredAt" to before(12).toString()),
        )
        assertEquals(200, patch(c, forgotten, exit).status)
        val later = close(c)
        assertEquals(480, (closureOf(later, unfinished.employeeId)["totals"] as Map<*, *>)["workedMinutes"])
        assertEquals(listOf(pending.employeeId), later.list("blocked[*].employeeId"))

        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(4, audit.at<List<Any>>("items[?(@.action=='week.closed')]").size)
        assertEquals(1, audit.at<List<Any>>("items[?(@.action=='week.reopened')]").size)
        assertEquals(1, audit.at<List<Any>>("items[?(@.action=='incident.opened')]").size)
    }

    @Test
    fun `the worker agrees or objects to their own closure, once, with their account or their phone`() {
        val c = companyWithFinishedWeek()
        val mine = staffed(c)
        val colleague = staffed(c)
        val third = staffed(c)
        for (who in listOf(mine, colleague, third)) shift(who, 40, 32)
        val worker = linkedWorker(c, mine.employeeId)
        val unlinked = member(c, "trabajador")
        val terminal = terminal(c, newSite(c))
        val closed = close(c)
        val myClosure = closureOf(closed, mine.employeeId)["id"] as String
        val theirClosure = closureOf(closed, colleague.employeeId)["id"] as String
        val thirdClosure = closureOf(closed, third.employeeId)["id"] as String
        fun closure(id: String, token: String) = call("GET", "/api/v1/week-closures/$id", token)

        // Su cierre lo ve; el de otra persona no existe para él.
        assertEquals(200, closure(myClosure, worker.token).status)
        assertProblem(404, "not_found", closure(theirClosure, worker.token))
        assertProblem(404, "not_found", closure(myClosure, unlinked.token))
        assertProblem(404, "not_found", acknowledge(theirClosure, worker.token))
        assertProblem(404, "not_found", acknowledge(theirClosure, assertion(mine.phone)))
        assertProblem(404, "not_found", acknowledge(UUID.randomUUID().toString(), worker.token))
        // Sólo acusa el trabajador: ni quien administra, ni una terminal, ni una cuenta sin fila del padrón.
        assertProblem(403, "forbidden", acknowledge(myClosure, c.adminToken))
        assertProblem(403, "forbidden", acknowledge(myClosure, assertion(terminal)))
        assertProblem(403, "forbidden", acknowledge(myClosure, unlinked.token))
        assertProblem(401, "unauthorized", acknowledge(myClosure, assertion(mine.phone, audience = "otra-audiencia")))
        assertProblem(401, "unauthorized", acknowledge(myClosure, assertion(mine.phone, signer = newKey())))
        for (bad in listOf("{}", """{"type":"enterado"}""", """{"type":"agreed","firma":"x"}""", json(mapOf("type" to "objected", "note" to "x".repeat(501))))) {
            assertProblem(422, "validation", acknowledge(myClosure, worker.token, bad))
        }
        assertEquals(0, count("select count(*) from closure_acknowledgement where tenant_id = ?", UUID.fromString(c.id)))

        val note = "El martes salí una hora después de lo que dice."
        val objection = acknowledge(myClosure, worker.token, json(mapOf("type" to "objected", "note" to note)))
        assertEquals(201, objection.status, objection.toString())
        assertEquals(listOf(myClosure, "objected", note), listOf<String>(objection.at("closureId"), objection.at("type"), objection.at("note")))
        assertTrue(sha256.matches(objection.at("evidenceHash")))
        Instant.parse(objection.at("at"))
        for (credential in listOf(worker.token, assertion(mine.phone))) {
            val personal = call("GET", "/api/v1/me/attendance?week=$yesterday&employeeId=${colleague.employeeId}", credential)
            assertEquals(200, personal.status, personal.toString())
            assertEquals(mine.employeeId, personal.at("employeeId"))
            assertEquals(objection.whole(), personal.at<Map<String, Any?>>("acknowledgement"))
        }
        assertNull(call("GET", "/api/v1/me/attendance?week=$yesterday", assertion(colleague.phone)).at<Any?>("acknowledgement"))
        // Una vez por cierre, venga de donde venga.
        assertProblem(409, "already_acknowledged", acknowledge(myClosure, worker.token))
        assertProblem(409, "already_acknowledged", acknowledge(myClosure, assertion(mine.phone)))
        // El cierre lo muestra y lo que se cerró no cambió.
        val seen = closure(myClosure, c.adminToken)
        assertEquals(objection.whole(), seen.at<Map<String, Any?>>("acknowledgement"))
        assertEquals(listOf("closed", closureOf(closed, mine.employeeId)["hash"]), listOf(seen.at<String>("status"), seen.at<String>("hash")))

        // Desde su teléfono personal, sin nota.
        val agreed = acknowledge(theirClosure, assertion(colleague.phone))
        assertEquals(201, agreed.status, agreed.toString())
        assertEquals("agreed", agreed.at("type"))
        assertNull(agreed.at<Any?>("note"))
        val byActor = "select count(*) from closure_acknowledgement where tenant_id = ? and actor_type = ? and actor_id = ?"
        assertEquals(1, count(byActor, UUID.fromString(c.id), "device", colleague.phone.id))
        assertEquals(1, count(byActor, UUID.fromString(c.id), "user", worker.id))

        // Un cierre reabierto no tiene nada vigente que acusar.
        assertEquals(200, reopen(thirdClosure, c.adminToken).status)
        assertProblem(409, "closure_not_closed", acknowledge(thirdClosure, assertion(third.phone)))

        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(2, audit.at<List<Any>>("items[?(@.action=='week.acknowledged')]").size)
        assertFalse(note in audit.body)
        assertEquals(200, reopen(myClosure, c.adminToken).status)
        assertNull(call("GET", "/api/v1/me/attendance?week=$yesterday", worker.token).at<Any?>("acknowledgement"))
        val replacement = closureOf(close(c), mine.employeeId)
        assertEquals(2, replacement["version"])
        assertNull(call("GET", "/api/v1/me/attendance?week=$yesterday", worker.token).at<Any?>("acknowledgement"))
        assertEquals(objection.whole(), closure(myClosure, worker.token).at<Map<String, Any?>>("acknowledgement"))
    }

    @Test
    fun `labor rules are rows with validity and source`() {
        val c = company()
        val all = call("GET", "/api/v1/rule-sets", c.adminToken)
        assertEquals(200, all.status, all.toString())
        assertEquals(listOf("2026-01-01", "2027-01-01", "2028-01-01", "2029-01-01", "2030-01-01"), all.list("items[*].validFrom"))
        assertEquals(listOf("2026-12-31", "2027-12-31", "2028-12-31", "2029-12-31", null), all.at<List<String?>>("items[*].validTo"))
        assertEquals(listOf(2880, 2760, 2640, 2520, 2400), all.at<List<Int>>("items[*].weeklyOrdinaryMaxMinutes"))
        // Los demás topes van como texto, con la unidad en el nombre.
        assertEquals(listOf("540", "540", "600", "660", "720"), all.list("items[*].parameters.weeklyOvertimeMaxMinutes"))
        assertEquals(setOf("720"), all.list("items[*].parameters.dailyCombinedMaxMinutes").toSet())
        assertEquals(setOf("MX-LFT"), all.list("items[*].jurisdiction").toSet())
        assertEquals(setOf(1), all.at<List<Int>>("items[*].version").toSet())
        assertEquals(2, all.at<Int>("items[0].sources.length()"))
        assertTrue(all.at<String>("items[0].sources[0]").contains("dof.gob.mx"))

        fun effective(date: String) = call("GET", "/api/v1/rule-sets?effectiveOn=$date", c.adminToken)
        assertEquals(listOf(2760), effective("2027-06-15").at<List<Int>>("items[*].weeklyOrdinaryMaxMinutes"))
        assertEquals(listOf(2880), effective("2026-12-31").at<List<Int>>("items[*].weeklyOrdinaryMaxMinutes"))
        assertEquals(listOf(2760), effective("2027-01-01").at<List<Int>>("items[*].weeklyOrdinaryMaxMinutes"))
        // La última no tiene fin; antes de la primera no hay reglas registradas.
        assertEquals(listOf(2400), effective("2034-03-01").at<List<Int>>("items[*].weeklyOrdinaryMaxMinutes"))
        assertEquals(0, effective("2025-12-31").at<Int>("items.length()"))
        assertProblem(422, "validation", effective("ayer"))
    }

    @Test
    fun `two companies do not see or touch each other's weeks, incidents or closures`() {
        val a = companyWithFinishedWeek()
        val b = companyWithFinishedWeek()
        val flagged = staffed(a, newSite(a))
        val incidentOfA = marked(flagged, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        marked(flagged, before(32))
        val clean = staffed(a)
        shift(clean, 40, 32)
        val closureOfA = closureOf(close(a, listOf(clean.employeeId)), clean.employeeId)["id"] as String
        val ofB = staffed(b)
        val eventOfB = marked(ofB, before(40)).at<String>("eventId")
        marked(ofB, before(32))
        val workerOfB = linkedWorker(b, ofB.employeeId)
        val reason = "No debería poder decidir sobre esto."

        // Para la otra empresa, nada de esto existe.
        assertProblem(404, "not_found", week(b, flagged.employeeId))
        assertEquals(0, call("GET", "/api/v1/incidents", b.adminToken).at<Int>("items.length()"))
        assertProblem(404, "not_found", call("GET", "/api/v1/incidents/$incidentOfA", b.adminToken))
        assertProblem(404, "not_found", patch(b, incidentOfA, resolution("justified", reason)))
        assertProblem(404, "not_found", patch(b, incidentOfA, """{"assigneeUserId":"${b.adminId}"}"""))
        assertEquals(0, call("GET", "/api/v1/week-closures?week=$yesterday", b.adminToken).at<Int>("items.length()"))
        assertEquals(0, call("GET", "/api/v1/week-closures?week=$yesterday&employeeId=${clean.employeeId}", b.adminToken).at<Int>("items.length()"))
        assertProblem(404, "not_found", call("GET", "/api/v1/week-closures/$closureOfA", b.adminToken))
        assertProblem(404, "not_found", reopen(closureOfA, b.adminToken))
        assertProblem(404, "not_found", acknowledge(closureOfA, workerOfB.token))
        assertProblem(404, "not_found", acknowledge(closureOfA, assertion(ofB.phone)))
        assertProblem(422, "validation", close(b, listOf(clean.employeeId)))
        // Ni una empresa puede meter en lo suyo algo de la otra.
        assertProblem(422, "validation", patch(a, incidentOfA, resolution("adjusted", reason, mapOf("kind" to "exclude_event", "eventId" to eventOfB))))
        assertProblem(422, "validation", patch(a, incidentOfA, """{"assigneeUserId":"${workerOfB.id}"}"""))

        // Cerrar una empresa no cierra a nadie de la otra.
        val closedB = close(b)
        assertEquals(listOf(ofB.employeeId), closedB.list("closed[*].employeeId"))
        assertEquals(0, closedB.at<Int>("blocked.length()"))

        // Lo de la primera sigue intacto.
        val incident = call("GET", "/api/v1/incidents/$incidentOfA", a.adminToken)
        assertEquals("open", incident.at("status"))
        assertNull(incident.at<Any?>("assigneeUserId"))
        val untouched = call("GET", "/api/v1/week-closures/$closureOfA", a.adminToken)
        assertEquals("closed", untouched.at("status"))
        assertNull(untouched.at<Any?>("acknowledgement"))
        assertEquals(1, count("select count(*) from week_closure where tenant_id = ?", UUID.fromString(a.id)))
        val auditOfB = call("GET", "/api/v1/audit-log?limit=200", b.adminToken).body
        assertFalse(closureOfA in auditOfB || incidentOfA in auditOfB || clean.employeeId in auditOfB)
    }
}
