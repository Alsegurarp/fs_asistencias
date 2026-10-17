package mx.fastsolution.zenit

import mx.fastsolution.zenit.export.ExportCsv
import org.junit.jupiter.api.Tag
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Exportes de cierres y fuentes del padrón, con dos empresas. */
@Tag("integration")
class ExportsIT : WorkdayTestBase() {
    private fun wholeWeek() = """{"weekStart":"$yesterday","format":"csv"}"""

    private fun request(c: Company, body: String = wholeWeek(), key: String? = UUID.randomUUID().toString(), token: String = c.adminToken): Reply =
        call("POST", "/api/v1/exports", token, body, if (key == null) emptyMap() else mapOf("Idempotency-Key" to key))

    private fun export(c: Company, id: String, token: String = c.adminToken): Reply = call("GET", "/api/v1/exports/$id", token)

    private fun download(c: Company, id: String, token: String = c.adminToken): Reply = call("GET", "/api/v1/exports/$id/download", token)

    private fun manifest(c: Company, id: String, token: String = c.adminToken): Reply = call("GET", "/api/v1/exports/$id/manifest", token)

    private fun digest(text: String): String =
        MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

    private fun slug(c: Company): String = call("GET", "/api/v1/tenant", c.adminToken).at("slug")

    /** Persona con el nombre y el identificador que la prueba necesita ver en el archivo. */
    private fun person(c: Company, externalId: String, name: String, siteId: String? = null): Staffed {
        val created = call(
            "POST", "/api/v1/employees", c.adminToken,
            json(mapOf("externalId" to externalId, "displayName" to name, "siteId" to siteId, "employmentStart" to "2026-01-05")),
        )
        assertEquals(201, created.status, created.toString())
        val id = created.at<String>("id")
        return Staffed(id, newCard(c, id), phone(c, id))
    }

    @Test
    fun `an export is asked for once, prepared by a job and downloaded once`() {
        val c = companyWithFinishedWeek()
        val tenant = UUID.fromString(c.id)
        // Un nombre con acentos: la huella del manifiesto se compara byte por byte.
        assertEquals(200, call("PATCH", "/api/v1/tenant", c.adminToken, """{"name":"Panadería La Ñ"}""").status)
        val rh = member(c, "rh")
        val siteId = newSite(c)
        val siteName = call("GET", "/api/v1/sites/$siteId", c.adminToken).at<String>("name")
        val ana = person(c, "A-001", "Ana \"La Güera\" Núñez, hija", siteId)
        // Un nombre que una hoja de cálculo ejecutaría como fórmula.
        val formula = person(c, "A-002", "=SUMA(1;1)")
        val unfinished = person(c, "A-003", "Persona sin cerrar")
        shift(ana, 40, 32)
        shift(formula, 40, 31)
        marked(unfinished, before(20))
        val closed = close(c)
        val closureOfAna = closureOf(closed, ana.employeeId)
        val closureOfFormula = closureOf(closed, formula.employeeId)
        assertEquals(listOf(unfinished.employeeId), closed.list("blocked[*].employeeId"))
        val worker = linkedWorker(c, ana.employeeId)
        assertEquals(201, acknowledge(closureOfAna["id"] as String, worker.token, """{"type":"objected","note":"No estoy de acuerdo."}""").status)

        // Pedirlo exige una clave, una semana con cierres y un formato conocido.
        for (bad in listOf(
            "{}", """{"weekStart":"ayer","format":"csv"}""", """{"weekStart":"$yesterday"}""", """{"weekStart":"$yesterday","format":"xlsx"}""",
            """{"weekStart":"$yesterday","format":"csv","siteId":"${UUID.randomUUID()}"}""", """{"weekStart":"$yesterday","format":"csv","todo":true}""",
        )) {
            assertProblem(422, "validation", request(c, bad))
        }
        assertProblem(422, "validation", request(c, key = null))
        assertProblem(422, "validation", request(c, key = "no-es-una-clave"))
        val nothing = request(c, """{"weekStart":"$today","format":"csv"}""")
        assertProblem(422, "validation", nothing)
        assertEquals("no_closed_weeks", nothing.at("errors[0].code"))
        assertEquals(0, count("select count(*) from export where tenant_id = ?", tenant))

        val key = UUID.randomUUID().toString()
        val asked = request(c, key = key, token = rh.token)
        assertEquals(202, asked.status, asked.toString())
        val id = asked.at<String>("id")
        assertEquals(
            listOf("queued", lastWeek.toString(), "csv", "America/Mexico_City"),
            listOf<String>(asked.at("status"), asked.at("weekStart"), asked.at("format"), asked.at("timeZone")),
        )
        assertEquals(1, asked.at<Int>("ruleSetVersion"))
        for (field in listOf("siteId", "manifestHash", "fileHash", "rowCount", "downloadUrl", "expiresAt")) assertNull(asked.at<Any?>(field), field)
        // La misma clave devuelve el mismo exporte, y cualquier fecha de la semana es la misma petición.
        assertEquals(id, request(c, """{"weekStart":"$lastWeek","format":"csv"}""", key).at("id"))
        assertProblem(409, "idempotency_conflict", request(c, """{"weekStart":"$yesterday","format":"csv","siteId":"$siteId"}""", key))
        assertEquals(1, count("select count(*) from job where tenant_id = ? and type = 'export'", tenant))
        // Todavía no hay archivo ni manifiesto.
        assertProblem(409, "export_not_ready", manifest(c, id))
        assertProblem(409, "export_not_ready", download(c, id))
        assertEquals("queued", export(c, id).at("status"))

        assertTrue(jobWorker.drain() >= 1)
        val ready = export(c, id)
        assertEquals(listOf("ready", "/api/v1/exports/$id/download"), listOf<String>(ready.at("status"), ready.at("downloadUrl")))
        assertEquals(2, ready.at<Int>("rowCount"))
        assertTrue(sha256.matches(ready.at("manifestHash")) && sha256.matches(ready.at("fileHash")))
        val expires = Instant.parse(ready.at("expiresAt"))
        assertTrue(expires.isAfter(Instant.now().plusSeconds(14 * 60)) && expires.isBefore(Instant.now().plusSeconds(16 * 60)))

        // El manifiesto se entrega tal como se guardó: su huella es la publicada, y liga el archivo con los cierres.
        val declared = manifest(c, id, rh.token)
        assertEquals(200, declared.status, declared.toString())
        assertTrue(declared.contentType.startsWith("application/json"), declared.contentType)
        assertEquals("no-store", declared.header("Cache-Control"))
        assertEquals(ready.at<String>("manifestHash"), digest(declared.body))
        assertEquals(
            listOf(id, c.id, "Panadería La Ñ", lastWeek.toString(), ready.at<String>("fileHash")),
            listOf<String>(declared.at("exportId"), declared.at("tenant.id"), declared.at("tenant.name"), declared.at("weekStart"), declared.at("fileSha256")),
        )
        assertEquals(2, declared.at<Int>("rowCount"))
        assertEquals(listOf(closureOfAna["id"], closureOfFormula["id"]), declared.list("closures[*].closureId"))
        assertEquals(listOf(closureOfAna["hash"], closureOfFormula["hash"]), declared.list("closures[*].hash"))

        val file = download(c, id, member(c, "auditor").token)
        assertEquals(200, file.status, file.toString())
        assertTrue(file.contentType.startsWith("text/csv"), file.contentType)
        assertEquals("attachment; filename=\"zenit-${slug(c)}-$lastWeek.csv\"", file.header("Content-Disposition"))
        assertEquals("no-store", file.header("Cache-Control"))
        // La huella publicada es la del archivo que se descarga, byte por byte.
        assertEquals(ready.at<String>("fileHash"), digest(file.body))
        assertTrue(file.body.startsWith("﻿"))
        val lines = file.body.removePrefix("﻿").split("\r\n")
        assertEquals(4, lines.size)
        assertEquals("", lines[3])
        assertEquals(ExportCsv.HEADER.joinToString(","), lines[0])
        val start = "\"${slug(c)}\",$lastWeek,\"America/Mexico_City\",\"MX-LFT\",1"
        // Comillas dobladas, coma dentro de comillas y acentos intactos.
        assertEquals(
            "$start,\"A-001\",\"Ana \"\"La Güera\"\" Núñez, hija\",\"$siteName\",1,480,0,480,0,objected,${closureOfAna["closedAt"]},${closureOfAna["hash"]}",
            lines[1],
        )
        // La fórmula sale como texto, con un apóstrofo delante.
        assertEquals(
            "$start,\"A-002\",\"'=SUMA(1;1)\",\"\",1,540,0,540,0,,${closureOfFormula["closedAt"]},${closureOfFormula["hash"]}",
            lines[2],
        )
        assertFalse("A-003" in file.body)

        // El enlace es de un solo uso: descargado, el archivo ya no se conserva.
        assertProblem(410, "export_expired", download(c, id))
        val after = export(c, id)
        assertEquals("expired", after.at("status"))
        assertNull(after.at<Any?>("downloadUrl"))
        assertNull(after.at<Any?>("expiresAt"))
        assertEquals(ready.at<String>("fileHash"), after.at("fileHash"))
        assertEquals(1, count("select count(*) from export where tenant_id = ? and status = 'expired' and content is null and downloaded_by is not null", tenant))
        // El manifiesto sigue ahí después de descargar, idéntico.
        assertEquals(declared.body, manifest(c, id).body)
        // El manifiesto queda, y liga el archivo con los cierres por sus huellas; su propia huella se vuelve a calcular.
        val chained = "select count(*) from export where tenant_id = ? and manifest_hash = encode(sha256(convert_to(cast(manifest as text), 'UTF8')), 'hex') " +
            "and manifest ->> 'fileSha256' = cast(file_hash as text) and json_array_length(manifest -> 'closures') = 2 " +
            "and manifest -> 'closures' -> 0 ->> 'hash' = ?"
        assertEquals(1, count(chained, tenant, closureOfAna["hash"] as String))

        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        for (action in listOf("export.requested", "export.ready", "export.downloaded")) {
            assertEquals(1, audit.at<List<Any>>("items[?(@.action=='$action')]").size, action)
        }
        assertEquals(listOf("system"), audit.at<List<String>>("items[?(@.action=='export.ready')].actor.type"))
        assertFalse("Güera" in audit.body)
    }

    @Test
    fun `an export nobody downloads expires without keeping its file, and one that cannot be prepared says so`() {
        val c = companyWithFinishedWeek()
        val tenant = UUID.fromString(c.id)
        val one = staffed(c)
        shift(one, 40, 32)
        val closureId = closureOf(close(c), one.employeeId)["id"] as String

        val id = request(c).at<String>("id")
        jobWorker.drain()
        assertEquals("ready", export(c, id).at("status"))
        // Pasa el tiempo sin que nadie lo descargue.
        assertEquals(1, change("update export set expires_at = now() - interval '1 second' where tenant_id = ? and id = ?", tenant, UUID.fromString(id)))
        val lapsed = export(c, id)
        assertEquals("expired", lapsed.at("status"))
        assertNull(lapsed.at<Any?>("downloadUrl"))
        assertProblem(410, "export_expired", download(c, id))
        // El archivo sigue guardado hasta la siguiente vuelta de mantenimiento, que lo descarta.
        assertEquals(1, count("select count(*) from export where tenant_id = ? and content is not null", tenant))
        jobWorker.tick()
        assertEquals(0, count("select count(*) from export where tenant_id = ? and content is not null", tenant))
        assertEquals(1, count("select count(*) from export where tenant_id = ? and status = 'expired' and downloaded_at is null", tenant))

        // Entre pedirlo y prepararlo se reabre el cierre: ya no hay nada que exportar.
        val second = request(c).at<String>("id")
        assertEquals(200, reopen(closureId, c.adminToken).status)
        jobWorker.drain()
        val failed = export(c, second)
        assertEquals("failed", failed.at("status"))
        assertNull(failed.at<Any?>("downloadUrl"))
        assertProblem(410, "export_failed", download(c, second))
        assertProblem(410, "export_failed", manifest(c, second))
        assertProblem(422, "validation", request(c))

        // El proceso que lo preparaba murió en su último intento: el exporte no se queda esperando para siempre.
        assertEquals(201, close(c, listOf(one.employeeId)).status)
        val third = request(c).at<String>("id")
        assertEquals(
            1,
            change(
                "update job set status = 'running', attempts = max_attempts, lease_until = now() - interval '1 second' where reference_id = ?",
                UUID.fromString(third),
            ),
        )
        jobWorker.tick()
        assertEquals("failed", export(c, third).at("status"))
        assertEquals(1, count("select count(*) from job where reference_id = ? and status = 'failed' and last_error = 'lease_expired'", UUID.fromString(third)))

        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(2, audit.at<List<Any>>("items[?(@.action=='export.failed')]").size)
    }

    @Test
    fun `an export can be limited to a site, and each route admits only the roles the contract gives it`() {
        val c = companyWithFinishedWeek()
        val siteA = newSite(c)
        val siteB = newSite(c)
        for (who in listOf(person(c, "S-A", "Persona de la sede A", siteA), person(c, "S-B", "Persona de la sede B", siteB), person(c, "S-0", "Persona sin sede"))) {
            shift(who, 40, 32)
        }
        assertEquals(3, close(c).at<Int>("closed.length()"))

        val ofSite = request(c, """{"weekStart":"$yesterday","format":"csv","siteId":"$siteA"}""").at<String>("id")
        val whole = request(c).at<String>("id")
        jobWorker.drain()
        assertEquals(listOf(siteA, 1), listOf(export(c, ofSite).at<String>("siteId"), export(c, ofSite).at<Int>("rowCount")))
        val body = download(c, ofSite).body
        assertTrue("\"S-A\"" in body)
        assertFalse("\"S-B\"" in body || "\"S-0\"" in body)
        assertEquals(3, export(c, whole).at<Int>("rowCount"))
        // Una sede sin cierres no tiene qué exportar.
        assertProblem(422, "validation", request(c, """{"weekStart":"$yesterday","format":"csv","siteId":"${newSite(c)}"}"""))

        val people = linkedMapOf(
            "admin_empresa" to c.adminToken,
            "rh" to member(c, "rh").token,
            "supervisor" to member(c, "supervisor").token,
            "auditor" to member(c, "auditor").token,
            "trabajador" to member(c, "trabajador").token,
        )
        val exporters = arrayOf("admin_empresa", "rh", "auditor")

        class Route(val method: String, val path: String, val body: String?, vararg val allowed: String)
        val routes = listOf(
            Route("POST", "/api/v1/exports", wholeWeek(), *exporters),
            Route("GET", "/api/v1/exports/$whole", null, *exporters),
            Route("GET", "/api/v1/exports/$whole/download", null, *exporters),
            Route("GET", "/api/v1/exports/$whole/manifest", null, *exporters),
            Route("GET", "/api/v1/integrations/checkpoints", null, "admin_empresa", "rh"),
            // Lo que el contrato no abre sigue cerrado, también para quien administra.
            Route("GET", "/api/v1/exports", null),
            Route("DELETE", "/api/v1/exports/$whole", null),
            Route("POST", "/api/v1/integrations/checkpoints", "{}"),
            Route("GET", "/api/v1/jobs", null),
        )
        for (route in routes) {
            assertProblem(401, "unauthorized", call(route.method, route.path, null, route.body))
            for ((role, token) in people) {
                val reply = call(route.method, route.path, token, route.body, mapOf("Idempotency-Key" to UUID.randomUUID().toString()))
                if (role in route.allowed) {
                    // Pasa la puerta: el archivo se descarga una vez, así que el segundo recibe 410 y no 403.
                    assertFalse(reply.status == 401 || reply.status == 403, "$role ${route.method} ${route.path}: $reply")
                } else {
                    assertProblem(403, "forbidden", reply)
                }
            }
        }
        // La credencial de un dispositivo no entra a los exportes.
        val phone = phone(c, newEmployee(c))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/exports/$whole", assertion(phone)))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/exports/$whole/download", assertion(phone)))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/exports/$whole/manifest", assertion(phone)))
    }

    @Test
    fun `two companies do not see or download each other's exports or sources`() {
        val a = companyWithFinishedWeek()
        val b = companyWithFinishedWeek()
        for (c in listOf(a, b)) {
            shift(staffed(c), 40, 32)
            assertEquals(1, close(c).at<Int>("closed.length()"))
        }
        // La misma clave en otra empresa es otro exporte.
        val key = UUID.randomUUID().toString()
        val exportOfA = request(a, key = key).at<String>("id")
        val exportOfB = request(b, key = key).at<String>("id")
        assertNotEquals(exportOfA, exportOfB)
        jobWorker.drain()

        // Para la otra empresa, el exporte no existe: ni se ve ni se descarga.
        assertProblem(404, "not_found", export(b, exportOfA))
        assertProblem(404, "not_found", download(b, exportOfA))
        assertProblem(404, "not_found", manifest(b, exportOfA))
        assertEquals("ready", export(a, exportOfA).at("status"))
        // Y un exporte no se limita a la sede de otra empresa.
        assertProblem(422, "validation", request(a, """{"weekStart":"$yesterday","format":"csv","siteId":"${newSite(b)}"}"""))

        val file = download(a, exportOfA)
        assertEquals(200, file.status, file.toString())
        assertTrue("\"${slug(a)}\"" in file.body)
        assertFalse(slug(b) in file.body)
        assertEquals(1, export(b, exportOfB).at<Int>("rowCount"))
        // Descargar el de una no gasta el de la otra.
        assertEquals(200, download(b, exportOfB).status)

        // Las fuentes del padrón también son de cada empresa.
        val csv = "external_id,display_name,employment_start,site_name\nA-1,Persona A,2026-01-05,\n".toByteArray()
        assertEquals("applied", upload("/api/v1/imports/csv", a.adminToken, csv, dryRun = "false").at("status"))
        assertEquals(1, call("GET", "/api/v1/integrations/checkpoints", a.adminToken).at<Int>("items.length()"))
        assertEquals(0, call("GET", "/api/v1/integrations/checkpoints", b.adminToken).at<Int>("items.length()"))
        val auditOfB = call("GET", "/api/v1/audit-log?limit=200", b.adminToken).body
        assertFalse(exportOfA in auditOfB)
    }

    @Test
    fun `the sources of the directory show the last applied import`() {
        val c = company()
        fun sources() = call("GET", "/api/v1/integrations/checkpoints", c.adminToken)
        fun csv(name: String) = "external_id,display_name,employment_start,site_name\nC-1,$name,2026-01-05,\n".toByteArray()

        assertEquals(200, sources().status)
        assertEquals(0, sources().at<Int>("items.length()"))
        // Validar un archivo no es sincronizar.
        assertEquals("ready", upload("/api/v1/imports/csv", c.adminToken, csv("Persona Uno")).at("status"))
        assertEquals(0, sources().at<Int>("items.length()"))

        val applied = upload("/api/v1/imports/csv", c.adminToken, csv("Persona Uno"), dryRun = "false")
        assertEquals("applied", applied.at("status"))
        val first = sources()
        assertEquals(1, first.at<Int>("items.length()"))
        assertEquals(
            listOf("csv", "active", applied.at<String>("id"), "1"),
            listOf<String>(first.at("items[0].type"), first.at("items[0].status"), first.at("items[0].cursor"), first.at("items[0].sourceVersion")),
        )
        val sourceId = first.at<String>("items[0].sourceId")
        UUID.fromString(sourceId)
        Instant.parse(first.at("items[0].updatedAt"))

        // Otra carga mueve el punto de la misma fuente; no crea otra.
        val again = upload("/api/v1/imports/csv", c.adminToken, csv("Persona Uno Corregida"), dryRun = "false")
        val second = sources()
        assertEquals(1, second.at<Int>("items.length()"))
        assertEquals(listOf(sourceId, again.at<String>("id")), listOf<String>(second.at("items[0].sourceId"), second.at("items[0].cursor")))
    }
}
