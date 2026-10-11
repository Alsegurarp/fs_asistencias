package mx.fastsolution.zenit

import org.springframework.test.context.TestPropertySource
import java.sql.DriverManager
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.test.assertEquals

/**
 * Lo que comparten las pruebas que necesitan una semana cerrada.
 *
 * Una semana sólo se cierra cuando ya terminó, y un marcaje sólo se acepta si
 * tiene menos de tres días. Por eso cada empresa de estas pruebas empieza su
 * semana hoy: la anterior acaba de terminar y todavía admite marcajes. Según
 * la hora en que corran, esos marcajes pueden tener más de un día; la marca
 * tardía por antigüedad la cubre CaptureIT y aquí su umbral se aleja para que
 * no dependa del reloj.
 */
@TestPropertySource(properties = ["zenit.capture.late-sync-hours=1000"])
abstract class WorkdayTestBase : CaptureTestBase() {
    protected val zone = ZoneId.of("America/Mexico_City")
    protected val today: LocalDate = LocalDate.now(zone)
    protected val midnight: Instant = today.atStartOfDay(zone).toInstant()
    protected val yesterday: LocalDate = today.minusDays(1)

    /** Inicio de la semana que acaba de terminar. */
    protected val lastWeek: LocalDate = today.minusDays(7)
    protected val sha256 = Regex("^[0-9a-f]{64}$")

    /** Instante de la semana que acaba de terminar: tanto tiempo antes de la medianoche de hoy. */
    protected fun before(hours: Long, minutes: Long = 0): Instant = midnight.minusSeconds(hours * 3600 + minutes * 60)

    protected fun companyWithFinishedWeek(breakPolicy: String = "not_considered"): Company {
        val c = company()
        val changed = call(
            "PATCH", "/api/v1/tenant", c.adminToken,
            """{"weekStartsOn":"${today.dayOfWeek.name.lowercase()}","breakPolicy":"$breakPolicy"}""",
        )
        assertEquals(200, changed.status, changed.toString())
        return c
    }

    /** Persona del padrón con su tarjeta y su teléfono personal. */
    protected class Staffed(val employeeId: String, val card: String, val phone: Phone)

    protected fun staffed(c: Company, siteId: String? = null): Staffed {
        val employeeId = newEmployee(c, siteId)
        return Staffed(employeeId, newCard(c, employeeId), phone(c, employeeId))
    }

    /** Marcaje que el servidor guardó; devuelve su recibo. */
    protected fun marked(who: Staffed, at: Instant, location: Map<String, Any?>? = here(), declared: String? = null): Reply {
        val reply = mark(who.phone, who.card, at, declared, location)
        assertEquals(201, reply.status, reply.toString())
        return reply
    }

    protected fun shift(who: Staffed, fromHours: Long, toHours: Long) {
        marked(who, before(fromHours))
        marked(who, before(toHours))
    }

    protected fun week(c: Company, employeeId: String, token: String = c.adminToken): Reply =
        call("GET", "/api/v1/employees/$employeeId/attendance?week=$yesterday", token)

    protected fun minutes(reply: Reply): List<Int> {
        assertEquals(200, reply.status, reply.toString())
        return reply.at("segments[*].minutes")
    }

    protected fun close(c: Company, employeeIds: List<String>? = null, token: String = c.adminToken, week: LocalDate = yesterday): Reply {
        val body = linkedMapOf<String, Any?>("weekStart" to week.toString())
        if (employeeIds != null) body["employeeIds"] = employeeIds
        return call("POST", "/api/v1/week-closures", token, json(body))
    }

    protected fun closureOf(result: Reply, employeeId: String): Map<String, Any?> {
        assertEquals(201, result.status, result.toString())
        return result.at<List<Map<String, Any?>>>("closed[?(@.employeeId=='$employeeId')]").single()
    }

    protected fun reopen(id: String, token: String, reason: String = "Llegó un marcaje después del cierre."): Reply =
        call("POST", "/api/v1/week-closures/$id/reopen", token, json(mapOf("reason" to reason)))

    protected fun acknowledge(id: String, token: String?, body: String = """{"type":"agreed"}"""): Reply =
        call("POST", "/api/v1/week-closures/$id/acknowledgements", token, body)

    protected fun resolution(decision: String, reason: String, adjustment: Map<String, Any?>? = null): String {
        val resolution = linkedMapOf<String, Any?>("decision" to decision, "reason" to reason)
        if (adjustment != null) resolution["adjustment"] = adjustment
        return json(mapOf("resolution" to resolution))
    }

    protected fun patch(c: Company, incidentId: String, body: String, token: String = c.adminToken): Reply =
        call("PATCH", "/api/v1/incidents/$incidentId", token, body)

    /** Cuenta de trabajador ligada a su fila del padrón. */
    protected fun linkedWorker(c: Company, employeeId: String): Member {
        val worker = member(c, "trabajador")
        val linked = call("PATCH", "/api/v1/users/${worker.id}", c.adminToken, """{"employeeId":"$employeeId"}""")
        assertEquals(200, linked.status, linked.toString())
        assertEquals(employeeId, linked.at("employeeId"))
        return worker
    }

    /** Cambio hecho directo en la base, con el rol del backend: sirve para simular que pasó el tiempo. */
    protected fun change(statement: String, vararg values: Any): Int =
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement(statement).use {
                values.forEachIndexed { index, value -> it.setObject(index + 1, value) }
                it.executeUpdate()
            }
        }

    protected fun count(statement: String, vararg values: Any): Int =
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement(statement).use {
                values.forEachIndexed { index, value -> it.setObject(index + 1, value) }
                it.executeQuery().use { rows -> if (rows.next()) rows.getInt(1) else 0 }
            }
        }
}
