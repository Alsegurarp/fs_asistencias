package mx.fastsolution.zenit

import mx.fastsolution.zenit.export.sha256

import com.networknt.schema.ExecutionContext
import com.networknt.schema.InputFormat
import com.networknt.schema.SchemaLocation
import com.networknt.schema.SchemaRegistry
import com.networknt.schema.dialect.Dialects
import mx.fastsolution.zenit.dossier.DossierArchive
import mx.fastsolution.zenit.dossier.DossierJob
import mx.fastsolution.zenit.jobs.JobRow
import org.junit.jupiter.api.Tag
import org.springframework.beans.factory.annotation.Autowired
import tools.jackson.databind.json.JsonMapper
import java.nio.file.Files
import java.nio.file.Path
import java.sql.DriverManager
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.function.Consumer
import java.util.zip.ZipFile
import kotlin.test.*

/** Historias por HTTP real, firma JWT, PostgreSQL y trabajador real; no mocks de permisos o persistencia. */
@Tag("integration")
class DossiersIT : WorkdayTestBase() {
    @Autowired private lateinit var dossierJob: DossierJob
    private val mapper = JsonMapper()

    private fun grant(c: Company, user: String = c.adminId, enabled: Boolean = true, token: String = c.adminToken) =
        call("PUT", "/api/v1/users/$user/dossier-permission", token, """{"enabled":$enabled}""")
    private fun permission(token: String?) = call("GET", "/api/v1/me/dossier-permission", token)
    private fun request(token: String, key: String? = UUID.randomUUID().toString(), body: String = """{"formatVersion":1}""") =
        call("POST", "/api/v1/dossiers", token, body, if (key == null) emptyMap() else mapOf("Idempotency-Key" to key))
    private fun dossier(token: String?, id: String) = call("GET", "/api/v1/dossiers/$id", token)
    private fun manifest(token: String, id: String) = call("GET", "/api/v1/dossiers/$id/manifest", token)
    private fun uuid(id: String) = UUID.fromString(id)
    private fun prepare(c: Company, id: String) = dossierJob.handle(JobRow(UUID.randomUUID(), uuid(c.id), DossierJob.TYPE, uuid(id), 1, 5))

    /** Sólo la prueba lee el ZIP por SQL; ningún endpoint permite saltarse E4. */
    private fun <T> archive(c: Company, id: String, inspect: (ZipFile, Path) -> T): T {
        val file = Files.createTempFile("zenit-dossier-test-", ".zip")
        try {
            DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
                db.autoCommit = false
                db.prepareStatement("select content from dossier_chunk where tenant_id = ? and dossier_id = ? order by position").use { stmt ->
                    stmt.fetchSize = 1
                    stmt.setObject(1, uuid(c.id)); stmt.setObject(2, uuid(id))
                    stmt.executeQuery().use { rows -> Files.newOutputStream(file).use { out -> while (rows.next()) rows.getBinaryStream(1).use { it.copyTo(out) } } }
                }
                db.rollback()
            }
            return ZipFile(file.toFile()).use { inspect(it, file) }
        } finally { Files.deleteIfExists(file) }
    }

    @Test
    fun `story Ana receives permission prepares her company history verifies it and loses access on revocation`() {
        val c = companyWithFinishedWeek()
        val other = company()
        val site = newSite(c)
        val one = staffed(c, site)
        val pending = staffed(c, site)
        val ana = member(c, "rh")
        val coworker = member(c, "auditor")
        val worker = linkedWorker(c, one.employeeId)
        // Una marca fuera de sede exige una decisión con motivo y ajuste.
        val outside = marked(one, before(40), here(latitude = 19.44))
        marked(one, before(32))
        assertEquals(200, patch(c, outside.at("incident.id"), resolution("adjusted", "Se confirma la jornada.", mapOf("kind" to "retype_event", "eventId" to outside.at<String>("eventId"), "eventType" to "clock_in"))).status)
        marked(pending, before(20))
        val firstClosure = closureOf(close(c), one.employeeId)["id"] as String
        assertEquals(201, acknowledge(firstClosure, worker.token, """{"type":"objected","note":"Revisar el descanso histórico."}""").status)
        assertEquals(200, reopen(firstClosure, c.adminToken).status)
        val secondClosure = closureOf(close(c, listOf(one.employeeId)), one.employeeId)["id"] as String
        assertEquals(201, acknowledge(secondClosure, worker.token).status)
        val run = call("POST", "/api/v1/week-closure-runs", c.adminToken, """{"weekStart":"$yesterday"}""")
        assertEquals(202, run.status, run.toString())
        jobWorker.drain()
        assertEquals(1, count("select count(*) from week_closure_run_blocked where tenant_id = ?", uuid(c.id)))
        // La empresa ajena tiene datos, que nunca deben aparecer en el expediente.
        newEmployee(other)
        assertFalse(permission(ana.token).at("enabled"))
        assertProblem(403, "forbidden", request(ana.token))
        assertEquals(200, grant(c, ana.id).status)
        assertEquals(200, grant(c, ana.id).status)
        assertEquals(1, count("select count(*) from audit_log where tenant_id = ? and action = 'dossier.permission_granted'", uuid(c.id)))
        assertTrue(permission(ana.token).at("enabled"))
        val key = UUID.randomUUID().toString()
        val asked = request(ana.token, key)
        assertEquals(202, asked.status, asked.toString())
        val id = asked.at<String>("id")
        assertEquals(ana.id, asked.at("requestedBy"))
        assertEquals(c.id, asked.at("tenantId"))
        assertEquals("queued", asked.at("status"))
        assertEquals("no-store", asked.header("Cache-Control"))
        assertEquals(id, request(ana.token, key).at("id"))
        assertEquals(1, count("select count(*) from job where reference_id = ? and type = 'dossier'", uuid(id)))
        assertProblem(409, "dossier_not_ready", manifest(ana.token, id))
        jobWorker.drain()
        val ready = dossier(ana.token, id)
        assertEquals("ready", ready.at("status"), ready.toString())
        val declared = manifest(ana.token, id)
        assertEquals(200, declared.status)
        assertEquals("no-store", declared.header("Cache-Control"))
        assertEquals(ready.at<String>("manifestSha256"), sha256(declared.body.toByteArray()))
        val directory = Path.of(System.getProperty("zenit.contract")).parent
        val schemaText = Files.readString(directory.resolve("dossier-format.schema.yaml"))
        val registry = SchemaRegistry.withDialect(Dialects.getDraft202012()) { it.schemas(mapOf("https://zenit.invalid/format.yaml" to schemaText)) }
        val recordSchema = registry.getSchema(SchemaLocation.of("https://zenit.invalid/format.yaml#/\$defs/Record"))
        val records = archive(c, id) { zip, file ->
            assertEquals(setOf("README.txt", "manifest.json", "records.ndjson"), zip.entries().asSequence().map { it.name }.toSet())
            assertEquals(declared.body, zip.getInputStream(zip.getEntry("manifest.json")).reader(Charsets.UTF_8).readText())
            assertEquals(ready.at<String>("fileSha256"), Files.newInputStream(file).use { input -> val digest = java.security.MessageDigest.getInstance("SHA-256"); val buffer = ByteArray(8192); while (true) { val read = input.read(buffer); if (read < 0) break; digest.update(buffer, 0, read) }; digest.digest().joinToString("") { "%02x".format(it) } })
            val rows = zip.getInputStream(zip.getEntry("records.ndjson")).bufferedReader().use { it.lineSequence().map(mapper::readTree).toList() }
            for (row in rows) {
                assertEquals(c.id, row.get("tenantId").asString())
                assertEquals(emptyList(), recordSchema.validate(row.toString(), InputFormat.JSON, Consumer<ExecutionContext> { context -> context.executionConfig { it.formatAssertionsEnabled(true) } }), row.toString())
            }
            val inventory = mapper.readTree(declared.body)
            for (entry in inventory.get("files")) {
                val bytes = zip.getInputStream(zip.getEntry(entry.get("path").asString())).readAllBytes()
                assertEquals(entry.get("bytes").asLong(), bytes.size.toLong())
                assertEquals(entry.get("sha256").asString(), sha256(bytes))
            }
            for ((kind, total) in inventory.get("counts").properties()) assertEquals(total.asInt(), rows.count { it.get("kind").asString() == kind }, kind)
            assertEquals(4, inventory.get("limitations").size())
            rows
        }
        val kinds = records.groupBy { it.get("kind").asString() }
        assertEquals(setOf(firstClosure, secondClosure), kinds.getValue("week_closure").map { it.at("/data/id").asString() }.toSet())
        assertEquals(setOf("reopened", "closed"), kinds.getValue("week_closure").map { it.at("/data/status").asString() }.toSet())
        assertEquals(setOf("objected", "agreed"), kinds.getValue("closure_acknowledgement").map { it.at("/data/type").asString() }.toSet())
        assertEquals(1, kinds.getValue("adjustment").size)
        for (row in kinds.getValue("week_closure")) {
            assertEquals(row.at("/data/hash").asString(), sha256(row.at("/data/snapshot").asString().toByteArray()))
        }
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement("select id, envelope from attendance_event where tenant_id = ?").use { stmt ->
                stmt.setObject(1, uuid(c.id)); stmt.executeQuery().use { rows -> while (rows.next()) assertEquals(rows.getString(2), kinds.getValue("attendance_event").single { it.at("/data/id").asString() == rows.getString(1) }.at("/data/envelope").asString()) }
            }
        }
        assertFalse(records.any { it.get("data").has("subject") || it.get("data").has("email") })
        assertEquals(200, grant(c, coworker.id).status)
        assertProblem(404, "not_found", dossier(coworker.token, id))
        assertEquals(200, grant(other).status)
        assertProblem(404, "not_found", dossier(other.adminToken, id))
        assertProblem(404, "not_found", manifest(other.adminToken, id))
        assertEquals(200, grant(c, ana.id, false).status)
        assertProblem(403, "forbidden", dossier(ana.token, id))
        assertProblem(403, "forbidden", manifest(ana.token, id))
        assertProblem(403, "forbidden", request(ana.token))
        assertEquals(200, grant(c, ana.id).status)
        assertEquals(3, count("select version from dossier_permission where tenant_id = ? and user_id = ?", uuid(c.id), uuid(ana.id)))
        assertEquals("ready", dossier(ana.token, id).at("status"))
        // No se habilita descarga hasta que E4 vincule/consuma MFA nuevo.
        assertProblem(403, "forbidden", call("POST", "/api/v1/dossiers/$id/download", ana.token, "{}"))
    }

    @Test
    fun `no role inherits permission and only an active administrator can grant it explicitly`() {
        val c = company()
        val roles = listOf("admin_empresa", "rh", "supervisor", "trabajador", "auditor")
        for (role in roles) {
            val who = member(c, role)
            assertFalse(permission(who.token).at("enabled"), role)
            assertProblem(403, "forbidden", request(who.token))
            assertProblem(403, "forbidden", dossier(who.token, UUID.randomUUID().toString()))
            if (role != "admin_empresa") assertProblem(403, "forbidden", grant(c, who.id, token = who.token))
            assertEquals(200, grant(c, who.id).status)
            assertTrue(permission(who.token).at("enabled"))
            assertEquals(202, request(who.token).status)
        }
        assertFalse(permission(c.adminToken).at("enabled"))
        assertEquals(200, grant(c).status)
        assertTrue(permission(c.adminToken).at("enabled"))
        assertProblem(401, "unauthorized", permission(null))
        assertProblem(403, "forbidden", permission(operator))
        assertProblem(403, "forbidden", request(operator))
        val device = terminal(c, newSite(c))
        assertProblem(401, "unauthorized", permission(assertion(device)))
        val foreign = company()
        assertProblem(404, "not_found", grant(c, foreign.adminId))
        val invited = call("POST", "/api/v1/users", c.adminToken, """{"email":"${email("pendiente")}","roles":["rh"]}""").at<String>("id")
        assertProblem(409, "user_not_linked", grant(c, invited))
        assertEquals(200, grant(c, invited, false).status)
        val disabled = member(c, "rh")
        assertEquals(200, call("PATCH", "/api/v1/users/${disabled.id}", c.adminToken, """{"disabled":true}""").status)
        assertProblem(409, "user_not_active", grant(c, disabled.id))
        assertEquals(200, grant(c, disabled.id, false).status)
        for (body in listOf("{}", """{"enabled":null}""", """{"enabled":"true"}""", """{"enabled":1}""", """{"enabled":true,"tenantId":"${c.id}"}""")) assertProblem(422, "validation", call("PUT", "/api/v1/users/${c.adminId}/dossier-permission", c.adminToken, body))
        for (body in listOf("{}", """{"formatVersion":2}""", """{"formatVersion":"1"}""", """{"formatVersion":1.5}""", """{"formatVersion":1,"tenantId":"${c.id}"}""", """{"formatVersion":1,"from":"2026-01-01"}""")) assertProblem(422, "validation", request(c.adminToken, body = body))
        assertProblem(422, "validation", request(c.adminToken, null))
        assertProblem(422, "validation", request(c.adminToken, "bad-key"))
        assertProblem(422, "validation", request(c.adminToken, "1-1-1-1-1"))
        assertEquals(202, request(c.adminToken, body = """{"formatVersion":1.0}""").status)
        jobWorker.drain()
    }

    @Test
    fun `disabling suspension and relinking are rechecked without transferring permission or old dossiers`() {
        val c = company()
        val owner = member(c, "rh")
        assertEquals(200, grant(c, owner.id).status)
        val key = UUID.randomUUID().toString()
        val id = request(owner.token, key).at<String>("id")
        prepare(c, id)
        val originalVersion = count("select dossier_access_version from tenant_user where tenant_id = ? and id = ?", uuid(c.id), uuid(owner.id))
        assertEquals(200, call("PATCH", "/api/v1/users/${owner.id}", c.adminToken, """{"disabled":true}""").status)
        assertProblem(403, "forbidden", dossier(owner.token, id))
        assertEquals(200, call("PATCH", "/api/v1/users/${owner.id}", c.adminToken, """{"disabled":false}""").status)
        assertEquals(originalVersion + 2, count("select dossier_access_version from tenant_user where tenant_id = ? and id = ?", uuid(c.id), uuid(owner.id)))
        assertEquals("ready", dossier(owner.token, id).at("status"))
        change("update tenant set status = 'suspended' where id = ?", uuid(c.id))
        assertProblem(403, "forbidden", dossier(owner.token, id))
        change("update tenant set status = 'active' where id = ?", uuid(c.id))
        assertEquals(200, call("POST", "/api/v1/users/${owner.id}/unlink", c.adminToken).status)
        val replacement = token(subject(), owner.email)
        assertEquals(owner.id, call("GET", "/api/v1/me", replacement).at("userId"))
        assertFalse(permission(replacement).at("enabled"))
        assertProblem(403, "forbidden", dossier(replacement, id))
        assertProblem(403, "forbidden", dossier(owner.token, id))
        assertEquals(200, grant(c, owner.id).status)
        assertProblem(404, "not_found", dossier(replacement, id))
        assertProblem(404, "not_found", request(replacement, key))
        assertEquals(202, request(replacement).status)
        jobWorker.drain()
    }

    @Test
    fun `concurrent requests share one job and a repeatable snapshot excludes writes committed during preparation`() {
        val c = company()
        newEmployee(c)
        val beforeSite = newSite(c)
        assertEquals(200, grant(c).status)
        val key = UUID.randomUUID().toString()
        Executors.newFixedThreadPool(6).use { pool ->
            val replies = (1..6).map { pool.submit<Reply> { request(c.adminToken, key) } }.map { it.get(20, TimeUnit.SECONDS) }
            replies.forEach { assertEquals(202, it.status, it.toString()) }
            assertEquals(1, replies.map { it.at<String>("id") }.toSet().size)
            val id = replies.first().at<String>("id")
            assertEquals(1, count("select count(*) from job where reference_id = ?", uuid(id)))
            DriverManager.getConnection(databaseUrl, "zenit_migrator", secret("db_migrator_password")).use { lock ->
                lock.autoCommit = false
                lock.createStatement().use { it.execute("lock table employee in access exclusive mode") }
                val preparing = pool.submit { prepare(c, id) }
                val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15)
                while (count("select count(*) from pg_locks where relation = 'employee'::regclass and mode = 'AccessShareLock' and not granted") == 0 && System.nanoTime() < deadline) Thread.sleep(25)
                assertTrue(System.nanoTime() < deadline, "El trabajador debe estar leyendo desde su instantánea, esperando la tabla employee")
                val laterSite = newSite(c)
                lock.prepareStatement("insert into employee (tenant_id,id,external_id,display_name,status,employment_start,source) values (?,?,'LATER','Después del corte','active',current_date,'manual')").use { it.setObject(1, uuid(c.id)); it.setObject(2, UUID.randomUUID()); it.executeUpdate() }
                lock.commit()
                preparing.get(30, TimeUnit.SECONDS)
                val declared = manifest(c.adminToken, id)
                assertEquals(1, declared.at<Int>("counts.employee"))
                assertEquals(1, declared.at<Int>("counts.site"))
                archive(c, id) { zip, _ ->
                    val rows = zip.getInputStream(zip.getEntry("records.ndjson")).bufferedReader().readText()
                    assertTrue(beforeSite in rows)
                    assertFalse(laterSite in rows || "Después del corte" in rows)
                }
                assertEquals(2, count("select count(*) from employee where tenant_id = ?", uuid(c.id)))
                assertEquals(2, count("select count(*) from site where tenant_id = ?", uuid(c.id)))
            }
        }
    }

    @Test
    fun `expired files are cleaned with original manifest retained and failed preparation publishes no partial chunks`() {
        val c = company()
        val who = staffed(c)
        assertEquals(200, grant(c).status)
        val id = request(c.adminToken).at<String>("id")
        prepare(c, id)
        val original = manifest(c.adminToken, id).body
        DriverManager.getConnection(databaseUrl, "zenit_migrator", secret("db_migrator_password")).use { db ->
            db.prepareStatement("update dossier set created_at = clock_timestamp() - interval '25 hours', expires_at = clock_timestamp() - interval '1 second' where tenant_id = ? and id = ?").use { it.setObject(1, uuid(c.id)); it.setObject(2, uuid(id)); it.executeUpdate() }
        }
        assertEquals("expired", dossier(c.adminToken, id).at("status"))
        dossierJob.maintain()
        assertEquals(0, count("select count(*) from dossier_chunk where dossier_id = ?", uuid(id)))
        assertEquals(original, manifest(c.adminToken, id).body)
        dossierJob.maintain()
        assertEquals(1, count("select count(*) from audit_log where tenant_id = ? and action = 'dossier.expired'", uuid(c.id)))
        // El archivo no válido falla después de empezar a escribir: la transacción descarta todos los bloques.
        change("update device set public_jwk = '{}'::jsonb where tenant_id = ? and id = ?", uuid(c.id), uuid(who.phone.id))
        val broken = request(c.adminToken).at<String>("id")
        change("update job set attempts = max_attempts - 1 where reference_id = ?", uuid(broken))
        jobWorker.drain(100)
        assertEquals("failed", dossier(c.adminToken, broken).at("status"))
        assertEquals("preparation_failed", dossier(c.adminToken, broken).at("failureCode"))
        assertEquals(0, count("select count(*) from dossier_chunk where dossier_id = ?", uuid(broken)))
        assertProblem(409, "dossier_not_ready", manifest(c.adminToken, broken))
        assertEquals(1, count("select count(*) from audit_log where tenant_id = ? and action = 'dossier.failed'", uuid(c.id)))
        change("update device set public_jwk = cast(? as jsonb) where tenant_id = ? and id = ?", who.phone.key.toPublicJWK().toJSONString(), uuid(c.id), uuid(who.phone.id))
        val retry = request(c.adminToken).at<String>("id")
        prepare(c, retry)
        assertEquals("ready", dossier(c.adminToken, retry).at("status"))
    }

    @Test
    fun `a retryable failure rolls back its snapshot and a later attempt publishes one complete archive`() {
        val c = company()
        val who = staffed(c)
        assertEquals(200, grant(c).status)
        val id = request(c.adminToken).at<String>("id")
        change("update device set public_jwk = '{}'::jsonb where tenant_id = ? and id = ?", uuid(c.id), uuid(who.phone.id))
        jobWorker.drain(100)
        assertEquals("queued", dossier(c.adminToken, id).at("status"))
        assertNull(dossier(c.adminToken, id).at<Any?>("snapshotAt"))
        assertEquals(0, count("select count(*) from dossier_chunk where dossier_id = ?", uuid(id)))
        newEmployee(c)
        change("update device set public_jwk = cast(? as jsonb) where tenant_id = ? and id = ?", who.phone.key.toPublicJWK().toJSONString(), uuid(c.id), uuid(who.phone.id))
        change("update job set next_run_at = now() where reference_id = ?", uuid(id))
        jobWorker.drain(100)
        assertEquals("ready", dossier(c.adminToken, id).at("status"))
        assertEquals(2, manifest(c.adminToken, id).at<Int>("counts.employee"))
        assertEquals(1, count("select count(*) from audit_log where target_id = ? and action = 'dossier.ready'", id))
    }

    @Test
    fun `annual profiles of 50 and 300 employees use bounded chunks and include every retained event`() {
        for (people in listOf(50, 300)) {
            val c = company()
            val site = newSite(c)
            val device = terminal(c, site)
            val tenant = uuid(c.id)
            // Datos ficticios por SQL para medir archivo/memoria, no autenticidad de captura.
            assertEquals(people, change(
                "insert into employee (tenant_id,id,external_id,display_name,status,site_id,employment_start,source) " +
                    "select ?, md5(cast(? as text) || '/employee/' || n)::uuid, 'PROFILE-' || n, 'Perfil ' || n, 'active', ?, '2025-01-01', 'manual' from generate_series(1,?) n",
                tenant, tenant, uuid(site), people,
            ))
            assertEquals(people, change(
                "insert into card (tenant_id,id,label,fingerprint,status) select tenant_id, md5(id::text || '/card')::uuid, external_id, md5(id::text), 'active' from employee where tenant_id = ?", tenant,
            ))
            assertEquals(people, change(
                "insert into card_assignment (tenant_id,id,card_id,employee_id,since) select tenant_id,gen_random_uuid(),md5(id::text || '/card')::uuid,id,'2025-01-01' from employee where tenant_id = ?", tenant,
            ))
            val events = people * 365 * 2
            assertEquals(events, change(
                "insert into attendance_event (tenant_id,id,idempotency_key,event_type,outcome,observed_at,received_at,time_zone,device_id,device_mode,session_id,sequence,employee_id,card_id,card_scheme,site_id,location_verdict,accuracy_m,envelope,payload_sha256) " +
                    "select e.tenant_id,gen_random_uuid(),gen_random_uuid(),case when mark = 0 then 'clock_in' else 'clock_out' end,'accepted', " +
                    "'2025-10-27'::timestamptz + day * interval '1 day' + (8 + mark*8) * interval '1 hour', clock_timestamp(),'America/Mexico_City',?,'terminal',?, " +
                    "row_number() over(order by e.id,day,mark),e.id,md5(e.id::text || '/card')::uuid,'uid_sha256',?,'inside',12, " +
                    "json_build_object('fixture','synthetic-capacity','employee',e.id,'day',day,'mark',mark,'evidence',repeat(md5(e.id::text || day || mark),16))::text, " +
                    "encode(sha256(convert_to(e.id::text || day || mark,'UTF8')),'hex') from employee e cross join generate_series(0,364) day cross join generate_series(0,1) mark where e.tenant_id = ?",
                uuid(device.id), uuid(device.session), uuid(site), tenant,
            ))
            assertEquals(200, grant(c).status)
            val asked = request(c.adminToken)
            assertEquals(202, asked.status, asked.toString())
            val id = asked.at<String>("id")
            val start = System.nanoTime()
            prepare(c, id)
            val ready = dossier(c.adminToken, id)
            assertEquals("ready", ready.at("status"), ready.toString())
            val declared = manifest(c.adminToken, id)
            assertEquals(people, declared.at<Int>("counts.employee"))
            assertEquals(events, declared.at<Int>("counts.attendance_event"))
            assertTrue(count("select max(octet_length(content)) from dossier_chunk where dossier_id = ?", uuid(id)) <= 65536)
            assertTrue(count("select count(*) from dossier_chunk where dossier_id = ?", uuid(id)) > 1)
            archive(c, id) { zip, path ->
                val counts = mutableMapOf<String, Long>()
                zip.getInputStream(zip.getEntry("records.ndjson")).bufferedReader().use { input ->
                    input.lineSequence().forEach { line ->
                        val row = mapper.readTree(line)
                        assertEquals(c.id, row.get("tenantId").asString())
                        val kind = row.get("kind").asString()
                        counts[kind] = (counts[kind] ?: 0L) + 1
                    }
                }
                val expected = mapper.readTree(declared.body).get("counts")
                for ((kind, total) in expected.properties()) assertEquals(total.asLong(), counts[kind] ?: 0L, kind)
                println("DOSSIER_PROFILE employees=$people days=365 events=$events zipBytes=${Files.size(path)} elapsedMs=${TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)} chunkLimit=65536 cursorFetch=256")
            }
        }
    }

    @Test
    fun `database rejects cross company permission and chunk links and protects dossier identity and original evidence`() {
        val c = company()
        val other = company()
        assertEquals(200, grant(c).status)
        val id = request(c.adminToken).at<String>("id")
        fun denied(state: String, statement: String, vararg values: Any) {
            val failure = assertFailsWith<java.sql.SQLException> { change(statement, *values) }
            assertEquals(state, failure.sqlState)
        }
        denied("23503", "insert into dossier_permission (tenant_id,user_id,enabled) values (?,?,false)", uuid(c.id), uuid(other.adminId))
        denied("23503", "insert into dossier_chunk (tenant_id,dossier_id,position,content) values (?,?,0,decode('00','hex'))", uuid(other.id), uuid(id))
        denied("42501", "update dossier set requested_by = ? where tenant_id = ? and id = ?", uuid(other.adminId), uuid(c.id), uuid(id))
        denied("42501", "delete from dossier where tenant_id = ? and id = ?", uuid(c.id), uuid(id))
        denied("42501", "delete from attendance_event where tenant_id = ?", uuid(c.id))
        denied("42501", "delete from audit_log where tenant_id = ?", uuid(c.id))
        val asked = dossier(c.adminToken, id)
        assertEquals(86400, java.time.Duration.between(java.time.Instant.parse(asked.at("createdAt")), java.time.Instant.parse(asked.at("expiresAt"))).seconds)
        // Vence todavía en cola: no genera manifiesto ni deja bloques.
        DriverManager.getConnection(databaseUrl, "zenit_migrator", secret("db_migrator_password")).use { db ->
            db.prepareStatement("update dossier set created_at = clock_timestamp() - interval '25 hours', expires_at = clock_timestamp() - interval '1 second' where tenant_id = ? and id = ?").use { it.setObject(1, uuid(c.id)); it.setObject(2, uuid(id)); it.executeUpdate() }
        }
        prepare(c, id)
        assertEquals("expired", dossier(c.adminToken, id).at("status"))
        assertProblem(409, "dossier_not_ready", manifest(c.adminToken, id))
        assertEquals(0, count("select count(*) from dossier_chunk where dossier_id = ?", uuid(id)))
    }
}
