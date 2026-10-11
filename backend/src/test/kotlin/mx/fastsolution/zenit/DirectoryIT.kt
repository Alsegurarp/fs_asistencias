package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Sedes, horarios, padrón, importación CSV y tarjetas, con dos empresas. */
@Tag("integration")
class DirectoryIT : ApiTestBase() {
    // La empresa de prueba vive en esta zona; el horario vigente se calcula con su fecha.
    private val today: LocalDate get() = LocalDate.now(ZoneId.of("America/Mexico_City"))

    private fun label() = "ZN-${UUID.randomUUID().toString().take(8)}"

    private fun fingerprint() = UUID.randomUUID().toString().replace("-", "")

    private fun site(c: Company, name: String = "Sucursal ${UUID.randomUUID().toString().take(6)}"): String {
        val reply = call(
            "POST", "/api/v1/sites", c.adminToken,
            """{"name":"$name","timeZone":"America/Mexico_City","latitude":19.432608,"longitude":-99.133209,"radiusMeters":80}""",
        )
        assertEquals(201, reply.status, reply.toString())
        return reply.at("id")
    }

    private fun schedule(c: Company, from: LocalDate = today.minusDays(30), to: LocalDate? = null): String {
        val validTo = to?.let { "\"$it\"" } ?: "null"
        val reply = call(
            "POST", "/api/v1/schedules", c.adminToken,
            """{"name":"Turno matutino","timeZone":"America/Mexico_City","validFrom":"$from","validTo":$validTo,"days":[""" +
                """{"dayOfWeek":"tuesday","startTime":"08:00","endTime":"16:30","breakMinutes":30},""" +
                """{"dayOfWeek":"monday","startTime":"08:00","endTime":"16:30","breakMinutes":30}]}""",
        )
        assertEquals(201, reply.status, reply.toString())
        return reply.at("id")
    }

    private fun employee(c: Company, externalId: String = "E-${UUID.randomUUID().toString().take(8)}", siteId: String? = null): String {
        val site = siteId?.let { "\"$it\"" } ?: "null"
        val reply = call(
            "POST", "/api/v1/employees", c.adminToken,
            """{"externalId":"$externalId","displayName":"Persona $externalId","siteId":$site,"employmentStart":"2026-01-05"}""",
        )
        assertEquals(201, reply.status, reply.toString())
        return reply.at("id")
    }

    private fun card(c: Company, label: String = label(), fingerprint: String = fingerprint()): String {
        val reply = call("POST", "/api/v1/cards", c.adminToken, """{"label":"$label","fingerprint":"$fingerprint"}""")
        assertEquals(201, reply.status, reply.toString())
        assertEquals("inventory", reply.at("status"))
        return reply.at("id")
    }

    private fun assign(c: Company, cardId: String, employeeId: String): Reply =
        call("POST", "/api/v1/cards/$cardId/assignments", c.adminToken, """{"employeeId":"$employeeId"}""")

    private fun employeeOf(c: Company, id: String): Reply = call("GET", "/api/v1/employees/$id", c.adminToken)

    private val routes: List<Triple<String, String, Set<String>>> by lazy {
        val id = UUID.randomUUID()
        val readers = setOf("admin_empresa", "rh", "supervisor", "auditor")
        val writers = setOf("admin_empresa", "rh")
        val admin = setOf("admin_empresa")
        listOf(
            Triple("GET", "/api/v1/sites", readers), Triple("POST", "/api/v1/sites", admin),
            Triple("GET", "/api/v1/sites/$id", readers), Triple("PATCH", "/api/v1/sites/$id", admin),
            Triple("GET", "/api/v1/schedules", readers), Triple("POST", "/api/v1/schedules", writers),
            Triple("GET", "/api/v1/schedules/$id", readers),
            Triple("GET", "/api/v1/employees", readers), Triple("POST", "/api/v1/employees", writers),
            Triple("GET", "/api/v1/employees/$id", readers), Triple("PATCH", "/api/v1/employees/$id", writers),
            Triple("POST", "/api/v1/employees/$id/schedule-assignments", writers),
            Triple("POST", "/api/v1/imports/csv", writers), Triple("GET", "/api/v1/imports/$id", writers),
            Triple("GET", "/api/v1/cards", setOf("admin_empresa", "rh", "auditor")), Triple("POST", "/api/v1/cards", writers),
            Triple("POST", "/api/v1/cards/$id/assignments", writers), Triple("POST", "/api/v1/cards/$id/revocation", writers),
        )
    }

    @Test
    fun `every directory route asks for a credential and admits only its roles`() {
        val c = company()
        val people = mapOf(
            "admin_empresa" to c.adminToken,
            "rh" to member(c, "rh").token,
            "supervisor" to member(c, "supervisor").token,
            "auditor" to member(c, "auditor").token,
            "trabajador" to member(c, "trabajador").token,
        )
        assertEquals(18, routes.size)
        for ((method, path, allowed) in routes) {
            val body = if (method == "GET") null else "{}"
            assertProblem(401, "unauthorized", call(method, path, body = body))
            // Quien opera el servicio no entra al padrón de ninguna empresa.
            assertProblem(403, "forbidden", call(method, path, operator, body))
            for ((role, token) in people) {
                val reply = call(method, path, token, body)
                if (role in allowed) {
                    // Pasa la puerta: lo que responda después ya es de la ruta.
                    assertFalse(reply.status == 401 || reply.status == 403, "$role $method $path: $reply")
                } else {
                    assertProblem(403, "forbidden", reply)
                }
            }
        }
        // Lo que este corte no abre sigue cerrado.
        assertProblem(403, "forbidden", call("GET", "/api/v1/employees/${UUID.randomUUID()}/attendance", c.adminToken))
        assertProblem(403, "forbidden", call("PATCH", "/api/v1/schedules/${UUID.randomUUID()}", c.adminToken, "{}"))
        assertProblem(403, "forbidden", call("DELETE", "/api/v1/employees/${UUID.randomUUID()}", c.adminToken))
    }

    @Test
    fun `two companies do not see or use each other's directory`() {
        val a = company()
        val b = company()
        val siteA = site(a)
        val siteB = site(b)
        val scheduleB = schedule(b)
        val employeeA = employee(a, siteId = siteA)
        val employeeB = employee(b, siteId = siteB)
        val cardA = card(a)
        val cardB = card(b)
        val importB = upload("/api/v1/imports/csv", b.adminToken, "external_id,display_name,employment_start,site_name\nB-1,Persona B,2026-01-05,\n".toByteArray())
        assertEquals(202, importB.status, importB.toString())

        // Lo ajeno no existe: ni se lee ni se cambia.
        for (path in listOf("/api/v1/sites/$siteB", "/api/v1/schedules/$scheduleB", "/api/v1/employees/$employeeB", "/api/v1/imports/${importB.at<String>("id")}")) {
            assertProblem(404, "not_found", call("GET", path, a.adminToken))
        }
        assertProblem(404, "not_found", call("PATCH", "/api/v1/sites/$siteB", a.adminToken, """{"status":"inactive"}"""))
        assertProblem(404, "not_found", call("PATCH", "/api/v1/employees/$employeeB", a.adminToken, """{"status":"inactive"}"""))
        assertProblem(404, "not_found", call("POST", "/api/v1/employees/$employeeB/schedule-assignments", a.adminToken, """{"scheduleId":"$scheduleB","validFrom":"$today"}"""))
        assertProblem(404, "not_found", assign(a, cardB, employeeA))
        assertProblem(404, "not_found", call("POST", "/api/v1/cards/$cardB/revocation", a.adminToken, """{"reason":"lost"}"""))

        // Tampoco se usa lo ajeno desde lo propio: para quien pregunta, no existe.
        assertProblem(422, "validation", call("POST", "/api/v1/employees", a.adminToken, """{"externalId":"X-1","displayName":"Persona","siteId":"$siteB","employmentStart":"2026-01-05"}"""))
        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$employeeA", a.adminToken, """{"siteId":"$siteB"}"""))
        assertProblem(422, "validation", call("POST", "/api/v1/employees/$employeeA/schedule-assignments", a.adminToken, """{"scheduleId":"$scheduleB","validFrom":"$today"}"""))
        assertProblem(422, "validation", assign(a, cardA, employeeB))
        assertEquals("active", call("GET", "/api/v1/sites/$siteB", b.adminToken).at("status"))
        assertEquals("active", employeeOf(b, employeeB).at("status"))
        assertNull(employeeOf(b, employeeB).at<Any?>("activeCardId"))

        assertEquals(listOf(siteA), call("GET", "/api/v1/sites", a.adminToken).list("items[*].id"))
        assertEquals(listOf(employeeA), call("GET", "/api/v1/employees", a.adminToken).list("items[*].id"))
        assertEquals(listOf(cardA), call("GET", "/api/v1/cards", a.adminToken).list("items[*].id"))
        assertEquals(emptyList(), call("GET", "/api/v1/schedules", a.adminToken).list("items[*].id"))
        assertEquals(emptyList(), call("GET", "/api/v1/employees?siteId=$siteB", a.adminToken).list("items[*].id"))

        // Lo que es único lo es dentro de cada empresa: dos empresas pueden coincidir.
        val sameLabel = label()
        val sameFingerprint = fingerprint()
        card(a, sameLabel, sameFingerprint)
        card(b, sameLabel, sameFingerprint)
        employee(a, "COMPARTIDO-1")
        employee(b, "COMPARTIDO-1")

        val auditOfA = call("GET", "/api/v1/audit-log?limit=200", a.adminToken)
        assertFalse(listOf(siteB, scheduleB, employeeB, cardB).any { it in auditOfA.body })
    }

    @Test
    fun `a site keeps a circular geofence within limits and is deactivated, not deleted`() {
        val c = company()
        val bad = call(
            "POST", "/api/v1/sites", c.adminToken,
            """{"name":"","timeZone":"Marte/Olimpo","latitude":91,"longitude":-181,"radiusMeters":10}""",
        )
        assertProblem(422, "validation", bad)
        assertEquals(setOf("name", "timeZone", "latitude", "longitude", "radiusMeters"), bad.list("errors[*].field").toSet())
        assertProblem(422, "validation", call("POST", "/api/v1/sites", c.adminToken, """{"name":"Centro","timeZone":"America/Mexico_City","latitude":19.4,"longitude":-99.1,"radiusMeters":80,"status":"inactive"}"""))
        assertProblem(422, "validation", call("POST", "/api/v1/sites", c.adminToken, """{"name":"Centro","timeZone":"America/Mexico_City","latitude":"norte","longitude":-99.1,"radiusMeters":80}"""))

        val id = site(c, "Sucursal Centro")
        val created = call("GET", "/api/v1/sites/$id", c.adminToken)
        assertEquals("active", created.at("status"))
        assertEquals(19.432608, created.at<Double>("latitude"))
        assertEquals(-99.133209, created.at<Double>("longitude"))
        assertEquals(80, created.at<Int>("radiusMeters"))

        assertProblem(422, "validation", call("PATCH", "/api/v1/sites/$id", c.adminToken, "{}"))
        assertProblem(422, "validation", call("PATCH", "/api/v1/sites/$id", c.adminToken, """{"radiusMeters":2001}"""))
        assertProblem(422, "validation", call("PATCH", "/api/v1/sites/$id", c.adminToken, """{"tenantId":"${UUID.randomUUID()}"}"""))
        val changed = call("PATCH", "/api/v1/sites/$id", c.adminToken, """{"radiusMeters":120,"status":"inactive"}""")
        assertEquals(200, changed.status, changed.toString())
        assertEquals(120, changed.at<Int>("radiusMeters"))
        assertEquals("inactive", changed.at("status"))
        assertEquals("Sucursal Centro", changed.at("name"))
        assertEquals(listOf(id), call("GET", "/api/v1/sites", c.adminToken).list("items[*].id"))
    }

    @Test
    fun `a schedule is created whole, validated day by day and never edited`() {
        val c = company()
        val bad = call(
            "POST", "/api/v1/schedules", c.adminToken,
            """{"name":"Turno","timeZone":"America/Mexico_City","validFrom":"2026-02-01","validTo":"2026-01-01","days":[""" +
                """{"dayOfWeek":"monday","startTime":"8:00","endTime":"16:00","breakMinutes":30},""" +
                """{"dayOfWeek":"tuesday","startTime":"08:00","endTime":"09:00","breakMinutes":60},""" +
                """{"dayOfWeek":"wednesday","startTime":"08:00","endTime":"16:00","breakMinutes":30},""" +
                """{"dayOfWeek":"wednesday","startTime":"09:00","endTime":"17:00","breakMinutes":30},""" +
                """{"dayOfWeek":"domingo","startTime":"08:00","endTime":"16:00","breakMinutes":481}]}""",
        )
        assertProblem(422, "validation", bad)
        assertEquals(
            setOf("validTo", "days[0].startTime", "days[1].breakMinutes", "days[3].dayOfWeek", "days[4].dayOfWeek", "days[4].breakMinutes"),
            bad.list("errors[*].field").toSet(),
        )
        assertProblem(422, "validation", call("POST", "/api/v1/schedules", c.adminToken, """{"name":"Sin días","timeZone":"America/Mexico_City","validFrom":"2026-01-01","days":[]}"""))

        val id = schedule(c, LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"))
        val created = call("GET", "/api/v1/schedules/$id", c.adminToken)
        assertEquals("2026-01-01", created.at("validFrom"))
        assertEquals("2026-12-31", created.at("validTo"))
        // Los días salen en orden de semana aunque se hayan mandado en otro.
        assertEquals(listOf("monday", "tuesday"), created.list("days[*].dayOfWeek"))
        assertEquals("08:00", created.at("days[0].startTime"))
        assertEquals("16:30", created.at("days[0].endTime"))
        assertEquals(30, created.at<Int>("days[0].breakMinutes"))

        // Un turno que termina al día siguiente es válido.
        val night = call(
            "POST", "/api/v1/schedules", c.adminToken,
            """{"name":"Nocturno","timeZone":"America/Mexico_City","validFrom":"2026-01-01","days":[{"dayOfWeek":"friday","startTime":"22:00","endTime":"06:00","breakMinutes":30}]}""",
        )
        assertEquals(201, night.status, night.toString())
        assertNull(night.at<Any?>("validTo"))
        assertEquals(2, call("GET", "/api/v1/schedules", c.adminToken).at<Int>("items.length()"))
    }

    @Test
    fun `an employee is unique by external id, changes field by field and leaves by logical termination`() {
        val c = company()
        val siteId = site(c)
        val id = employee(c, "E-100", siteId)
        assertProblem(409, "external_id_taken", call("POST", "/api/v1/employees", c.adminToken, """{"externalId":"E-100","displayName":"Otra persona","employmentStart":"2026-01-05"}"""))
        val bad = call("POST", "/api/v1/employees", c.adminToken, """{"externalId":"","displayName":"","siteId":"no-es-uuid","employmentStart":"5 de enero"}""")
        assertProblem(422, "validation", bad)
        assertEquals(setOf("externalId", "displayName", "siteId", "employmentStart"), bad.list("errors[*].field").toSet())

        val created = employeeOf(c, id)
        assertEquals("manual", created.at("source"))
        assertEquals("active", created.at("status"))
        assertEquals(siteId, created.at("siteId"))
        assertNull(created.at<Any?>("employmentEnd"))
        assertNull(created.at<Any?>("currentScheduleId"))
        assertNull(created.at<Any?>("activeCardId"))

        assertEquals("Nombre corregido", call("PATCH", "/api/v1/employees/$id", c.adminToken, """{"displayName":"Nombre corregido"}""").at("displayName"))
        // Mandar la sede en nulo la quita; no mandarla la deja como estaba.
        assertEquals(siteId, employeeOf(c, id).at("siteId"))
        assertNull(call("PATCH", "/api/v1/employees/$id", c.adminToken, """{"siteId":null}""").at<Any?>("siteId"))

        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$id", c.adminToken, "{}"))
        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$id", c.adminToken, """{"externalId":"E-200"}"""))
        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$id", c.adminToken, """{"employmentEnd":"2025-12-31"}"""))
        assertProblem(422, "validation", call("PATCH", "/api/v1/employees/$id", c.adminToken, """{"status":"despedido"}"""))

        val left = call("PATCH", "/api/v1/employees/$id", c.adminToken, """{"status":"inactive","employmentEnd":"2026-09-30"}""")
        assertEquals("inactive", left.at("status"))
        assertEquals("2026-09-30", left.at("employmentEnd"))
        assertEquals("E-100", employeeOf(c, id).at("externalId"))

        val other = employee(c, "E-101", siteId)
        assertEquals(listOf(other), call("GET", "/api/v1/employees?status=active", c.adminToken).list("items[*].id"))
        assertEquals(listOf(id), call("GET", "/api/v1/employees?status=inactive", c.adminToken).list("items[*].id"))
        assertEquals(listOf(other), call("GET", "/api/v1/employees?siteId=$siteId", c.adminToken).list("items[*].id"))
        assertProblem(422, "validation", call("GET", "/api/v1/employees?status=todos", c.adminToken))
        assertEquals(listOf("employee.deactivated"), call("GET", "/api/v1/audit-log?action=employee.deactivated", c.adminToken).list("items[*].action"))
    }

    @Test
    fun `assigning a schedule closes the previous one the day before`() {
        val c = company()
        val id = employee(c)
        val first = schedule(c, today.minusDays(30))
        val second = schedule(c, today.minusDays(30), today.plusDays(60))
        fun assign(scheduleId: String, from: LocalDate) =
            call("POST", "/api/v1/employees/$id/schedule-assignments", c.adminToken, """{"scheduleId":"$scheduleId","validFrom":"$from"}""")

        val one = assign(first, today.minusDays(10))
        assertEquals(201, one.status, one.toString())
        assertNull(one.at<Any?>("validTo"))
        assertEquals(first, employeeOf(c, id).at("currentScheduleId"))

        // Una asignación futura no cambia el horario de hoy, pero ya cierra la anterior.
        val two = assign(second, today.plusDays(5))
        assertEquals(201, two.status, two.toString())
        assertEquals(today.plusDays(60).toString(), two.at("validTo"))
        assertEquals(first, employeeOf(c, id).at("currentScheduleId"))

        assertProblem(422, "validation", assign(first, today.plusDays(5)))
        assertProblem(422, "validation", assign(first, today.minusDays(20)))
        assertProblem(422, "validation", assign(second, today.plusDays(90)))
        assertProblem(422, "validation", assign(UUID.randomUUID().toString(), today.plusDays(10)))
        assertProblem(422, "validation", assign("no-es-uuid", today.plusDays(10)))
        assertProblem(404, "not_found", call("POST", "/api/v1/employees/${UUID.randomUUID()}/schedule-assignments", c.adminToken, """{"scheduleId":"$first","validFrom":"$today"}"""))

        // Otra persona, con el segundo horario vigente desde hoy.
        val otherId = employee(c)
        assertEquals(201, call("POST", "/api/v1/employees/$otherId/schedule-assignments", c.adminToken, """{"scheduleId":"$second","validFrom":"$today"}""").status)
        assertEquals(second, employeeOf(c, otherId).at("currentScheduleId"))
    }

    @Test
    fun `a csv import validates first, applies once and reports each rejected row`() {
        val c = company()
        site(c, "Sucursal Centro")
        val csv = (
            "﻿external_id,display_name,employment_start,site_name\r\n" +
                "C-1,\"Apellido, Nombre\",2026-01-05,sucursal centro\r\n" +
                "C-2,Persona Dos,2026-02-01,\r\n" +
                ",Sin identificador,2026-02-01,\r\n" +
                "C-4,Fecha mala,01/02/2026,\r\n" +
                "C-1,Repetida,2026-01-05,\r\n" +
                "C-6,Sede desconocida,2026-01-05,Sucursal Norte\r\n" +
                "C-7,Columnas de menos,2026-01-05\r\n"
            ).toByteArray()
        fun employees() = call("GET", "/api/v1/employees", c.adminToken)

        // Sin indicarlo sólo valida: no crea a nadie.
        val dry = upload("/api/v1/imports/csv", c.adminToken, csv)
        assertEquals(202, dry.status, dry.toString())
        assertEquals("ready", dry.at("status"))
        assertEquals(true, dry.at<Boolean>("dryRun"))
        assertEquals(1, dry.at<Int>("templateVersion"))
        assertEquals(listOf(7, 2, 5), listOf(dry.at<Int>("counts.total"), dry.at<Int>("counts.accepted"), dry.at<Int>("counts.rejected")))
        assertEquals(listOf(4, 5, 6, 7, 8), dry.at<List<Int>>("errors[*].row"))
        assertEquals(
            listOf("missing_external_id", "invalid_date", "duplicate_in_file", "site_not_found", "wrong_column_count"),
            dry.list("errors[*].code"),
        )
        assertNull(dry.at<Any?>("errors[0].externalId"))
        assertEquals("C-4", dry.at("errors[1].externalId"))
        assertEquals(64, dry.at<String>("manifestHash").length)
        assertEquals(0, employees().at<Int>("items.length()"))
        assertEquals(dry.body, call("GET", "/api/v1/imports/${dry.at<String>("id")}", c.adminToken).body)

        // Aplicar es explícito y lleva su propia clave.
        val key = UUID.randomUUID().toString()
        val applied = upload("/api/v1/imports/csv", c.adminToken, csv, dryRun = "false", key = key)
        assertEquals("applied", applied.at("status"))
        assertEquals(dry.at<String>("manifestHash"), applied.at("manifestHash"))
        assertEquals(setOf("C-1", "C-2"), employees().list("items[*].externalId").toSet())
        val first = employees().at<List<Map<String, Any?>>>("items[?(@.externalId=='C-1')]").single()
        assertEquals("Apellido, Nombre", first["displayName"])
        assertEquals("csv", first["source"])
        assertNotNull(first["siteId"])

        // La misma clave devuelve el mismo resultado y no vuelve a aplicar; con otro contenido se rechaza.
        assertEquals(applied.body, upload("/api/v1/imports/csv", c.adminToken, csv, dryRun = "false", key = key).body)
        assertProblem(409, "idempotency_conflict", upload("/api/v1/imports/csv", c.adminToken, "external_id,display_name,employment_start,site_name\n".toByteArray(), dryRun = "false", key = key))
        assertProblem(409, "idempotency_conflict", upload("/api/v1/imports/csv", c.adminToken, csv, dryRun = "true", key = key))

        // Repetir el archivo con otra clave no duplica a nadie; un nombre corregido se actualiza.
        val again = upload("/api/v1/imports/csv", c.adminToken, "external_id,display_name,employment_start,site_name\nC-2,Persona Dos Corregida,2026-02-01,\nC-1,\"Apellido, Nombre\",2026-01-05,Sucursal Centro\n".toByteArray(), dryRun = "false")
        assertEquals("applied", again.at("status"))
        assertEquals(2, employees().at<Int>("items.length()"))
        assertTrue("Persona Dos Corregida" in employees().list("items[*].displayName"))

        // Un archivo que no es la plantilla no entra en absoluto.
        val wrongHeader = upload("/api/v1/imports/csv", c.adminToken, "id,nombre\n1,Persona\n".toByteArray(), dryRun = "false")
        assertEquals(202, wrongHeader.status, wrongHeader.toString())
        assertEquals("failed", wrongHeader.at("status"))
        assertEquals("invalid_header", wrongHeader.at("errors[0].code"))
        assertNull(wrongHeader.at<Any?>("manifestHash"))
        assertEquals("invalid_encoding", upload("/api/v1/imports/csv", c.adminToken, byteArrayOf(0xC3.toByte(), 0x28)).at("errors[0].code"))
        assertEquals(2, employees().at<Int>("items.length()"))

        assertProblem(422, "validation", upload("/api/v1/imports/csv", c.adminToken, csv, key = null))
        assertProblem(422, "validation", upload("/api/v1/imports/csv", c.adminToken, csv, key = "no-es-uuid"))
        assertProblem(422, "validation", upload("/api/v1/imports/csv", c.adminToken, null))
        assertProblem(422, "validation", upload("/api/v1/imports/csv", c.adminToken, csv, dryRun = "quizas"))
        assertProblem(422, "validation", upload("/api/v1/imports/csv", c.adminToken, ByteArray(1_200_000) { 'a'.code.toByte() }))
        assertProblem(422, "validation", call("POST", "/api/v1/imports/csv", c.adminToken, "{}"))
        assertEquals(1, call("GET", "/api/v1/audit-log?action=import.ready", c.adminToken).at<Int>("items.length()"))
        assertEquals(2, call("GET", "/api/v1/audit-log?action=import.applied", c.adminToken).at<Int>("items.length()"))
    }

    @Test
    fun `a card goes from inventory to a holder, is replaced in one step and never reassigned`() {
        val c = company()
        val person = employee(c)
        val secretFingerprint = fingerprint()
        val firstLabel = label()
        val first = card(c, firstLabel, secretFingerprint)
        assertProblem(409, "card_taken", call("POST", "/api/v1/cards", c.adminToken, """{"label":"$firstLabel","fingerprint":"${fingerprint()}"}"""))
        assertProblem(409, "card_taken", call("POST", "/api/v1/cards", c.adminToken, """{"label":"${label()}","fingerprint":"$secretFingerprint"}"""))
        assertProblem(422, "validation", call("POST", "/api/v1/cards", c.adminToken, """{"label":"${label()}","fingerprint":"corta"}"""))

        val assigned = assign(c, first, person)
        assertEquals(201, assigned.status, assigned.toString())
        assertEquals(person, assigned.at("employeeId"))
        assertNull(assigned.at<Any?>("until"))
        assertNull(assigned.at<Any?>("replacedCardId"))
        assertEquals(first, employeeOf(c, person).at("activeCardId"))

        // La segunda tarjeta reemplaza a la primera en la misma operación.
        val second = card(c)
        val replaced = assign(c, second, person)
        assertEquals(201, replaced.status, replaced.toString())
        assertEquals(first, replaced.at("replacedCardId"))
        assertEquals(second, employeeOf(c, person).at("activeCardId"))
        val cards = call("GET", "/api/v1/cards", c.adminToken)
        assertEquals(listOf("replaced", "active"), cards.list("items[*].status"))
        assertNull(cards.at<Any?>("items[0].assignment"))
        assertEquals(person, cards.at("items[1].assignment.employeeId"))
        // La huella entra al registrar y no vuelve a salir.
        assertFalse(secretFingerprint in cards.body)
        assertFalse("fingerprint" in cards.body)

        // Una tarjeta que ya tuvo titular no se asigna a nadie más.
        val someoneElse = employee(c)
        assertProblem(409, "card_not_assignable", assign(c, first, someoneElse))
        assertProblem(409, "card_not_assignable", assign(c, second, someoneElse))
        assertProblem(422, "validation", assign(c, card(c), UUID.randomUUID().toString()))

        // Perdida: deja de tener titular y no se revoca dos veces ni se reasigna.
        assertProblem(422, "validation", call("POST", "/api/v1/cards/$second/revocation", c.adminToken, """{"reason":"vendida"}"""))
        val lost = call("POST", "/api/v1/cards/$second/revocation", c.adminToken, """{"reason":"lost","note":"Reportada en la sede"}""")
        assertEquals(200, lost.status, lost.toString())
        assertEquals("lost", lost.at("status"))
        assertNull(lost.at<Any?>("assignment"))
        assertNull(employeeOf(c, person).at<Any?>("activeCardId"))
        assertProblem(409, "card_not_revocable", call("POST", "/api/v1/cards/$second/revocation", c.adminToken, """{"reason":"revoked"}"""))
        assertProblem(409, "card_not_revocable", call("POST", "/api/v1/cards/$first/revocation", c.adminToken, """{"reason":"revoked"}"""))
        assertProblem(409, "card_not_assignable", assign(c, second, person))

        // Una tarjeta de inventario dañada tampoco se asigna después.
        val damaged = card(c)
        assertEquals("damaged", call("POST", "/api/v1/cards/$damaged/revocation", c.adminToken, """{"reason":"damaged"}""").at("status"))
        assertProblem(409, "card_not_assignable", assign(c, damaged, person))

        // A una persona dada de baja no se le asigna tarjeta.
        call("PATCH", "/api/v1/employees/$someoneElse", c.adminToken, """{"status":"inactive"}""")
        assertProblem(409, "employee_inactive", assign(c, card(c), someoneElse))

        assertEquals(listOf(damaged), call("GET", "/api/v1/cards?status=damaged", c.adminToken).list("items[*].id"))
        assertProblem(422, "validation", call("GET", "/api/v1/cards?status=rota", c.adminToken))
        val revocations = call("GET", "/api/v1/audit-log?action=card.revoked", c.adminToken)
        assertEquals(setOf("lost", "damaged"), revocations.list("items[*].metadata.reason").toSet())
        assertEquals(2, call("GET", "/api/v1/audit-log?action=card.assigned", c.adminToken).at<Int>("items.length()"))
        assertNotEquals(first, second)
    }
}
