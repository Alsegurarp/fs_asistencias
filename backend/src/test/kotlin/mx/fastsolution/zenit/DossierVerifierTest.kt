package mx.fastsolution.zenit

import mx.fastsolution.zenit.dossier.DossierVerifier
import mx.fastsolution.zenit.export.sha256
import tools.jackson.databind.json.JsonMapper
import tools.jackson.databind.node.ObjectNode
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.test.*

class DossierVerifierTest {
    private val fixture = Path.of(System.getProperty("zenit.contractsDirectory"), "examples/dossier-v1")
    private val json = JsonMapper()
    private val verifier = DossierVerifier()

    private fun archive(change: (MutableMap<String, ByteArray>) -> Unit = {}, check: (Path, String, String) -> Unit) {
        val files = listOf("manifest.json", "README.txt", "records.ndjson").associateWith { Files.readAllBytes(fixture.resolve(it)) }.toMutableMap()
        change(files)
        val path = Files.createTempFile("dossier-offline-", ".zip")
        try {
            ZipOutputStream(Files.newOutputStream(path)).use { zip -> files.forEach { (name, bytes) -> zip.putNextEntry(ZipEntry(name)); zip.write(bytes); zip.closeEntry() } }
            check(path, sha256(files.getValue("manifest.json")), sha256(Files.readAllBytes(path)))
        } finally { Files.deleteIfExists(path) }
    }

    private fun rewrite(files: MutableMap<String, ByteArray>, edit: (ObjectNode) -> Unit) {
        val rows = files.getValue("records.ndjson").toString(Charsets.UTF_8).lineSequence().filter { it.isNotEmpty() }.map { json.readTree(it) as ObjectNode }.toList()
        rows.forEach(edit)
        files["records.ndjson"] = (rows.joinToString("\n") { it.toString() } + "\n").toByteArray()
        val manifest = json.readTree(files.getValue("manifest.json")) as ObjectNode
        manifest.get("files").forEach { file -> if (file.get("path").asString() == "records.ndjson") {
            (file as ObjectNode).put("bytes", files.getValue("records.ndjson").size)
            file.put("sha256", sha256(files.getValue("records.ndjson")))
        } }
        files["manifest.json"] = (manifest.toString() + "\n").toByteArray()
    }

    private fun acknowledged(files: MutableMap<String, ByteArray>, edit: (MutableList<ObjectNode>) -> Unit) {
        val manifest = json.readTree(files.getValue("manifest.json")) as ObjectNode
        val tenant = manifest.get("tenantId").asString()
        val user = manifest.get("requestedBy").asString()
        val employee = UUID.randomUUID().toString()
        val other = UUID.randomUUID().toString()
        val rule = UUID.randomUUID().toString()
        val closure = UUID.randomUUID().toString()
        val snapshotHash = sha256("{}".toByteArray())
        val evidenceHash = sha256("$snapshotHash|agreed||2026-10-12T16:00:00.123456Z|user:$user".toByteArray(Charsets.UTF_8))
        val rows = files.getValue("records.ndjson").toString(Charsets.UTF_8).lineSequence().filter { it.isNotEmpty() }
            .map { json.readTree(it) as ObjectNode }.toMutableList()
        for ((id, external) in listOf(employee to "QA-001", other to "QA-002")) {
            rows += json.readTree("""{"kind":"employee","tenantId":"$tenant","data":{"id":"$id","external_id":"$external","display_name":"Persona ficticia","status":"active","site_id":null,"employment_start":"2026-01-01","employment_end":null,"source":"manual","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}}""") as ObjectNode
        }
        rows += json.readTree("""{"kind":"rule_set","tenantId":"$tenant","data":{"id":"$rule","jurisdiction":"MX-LFT","version":1,"valid_from":"2026-01-01","valid_to":null,"weekly_ordinary_max_minutes":2880,"parameters":{},"sources":[],"created_at":"2026-01-01T00:00:00Z"}}""") as ObjectNode
        // El acuse precede a su cierre, como en el archivo ordenado por colección.
        rows += json.readTree("""{"kind":"closure_acknowledgement","tenantId":"$tenant","data":{"id":"${UUID.randomUUID()}","closure_id":"$closure","employee_id":"$employee","type":"agreed","note":null,"at":"2026-10-12T16:00:00.123456Z","actor_type":"user","actor_id":"$user","evidence_hash":"$evidenceHash"}}""") as ObjectNode
        rows += json.readTree("""{"kind":"week_closure","tenantId":"$tenant","data":{"id":"$closure","employee_id":"$employee","week_start":"2026-10-05","version":1,"status":"closed","rule_set_id":"$rule","rule_set_version":1,"worked_minutes":0,"break_minutes":0,"ordinary_minutes":0,"overtime_minutes":0,"snapshot":"{}","hash":"$snapshotHash","closed_at":"2026-10-12T15:00:00Z","closed_by":"$user","reopened_at":null,"reopened_by":null,"reopen_reason":null}}""") as ObjectNode
        edit(rows)
        files["records.ndjson"] = (rows.joinToString("\n") { it.toString() } + "\n").toByteArray(Charsets.UTF_8)
        val counts = manifest.get("counts") as ObjectNode
        counts.propertyNames().toList().forEach { kind -> counts.put(kind, rows.count { it.get("kind").asString() == kind }) }
        files["manifest.json"] = (manifest.toString() + "\n").toByteArray(Charsets.UTF_8)
        rewrite(files) {}
    }

    @Test fun `acknowledgements remain verifiable after their closure is reopened`() {
        for (status in listOf("closed", "reopened")) archive({ files ->
            acknowledged(files) { rows ->
                if (status == "reopened") {
                    val closure = rows.single { it.get("kind").asString() == "week_closure" }.get("data") as ObjectNode
                    closure.put("status", status).put("reopened_at", "2026-10-13T00:00:00Z")
                        .put("reopened_by", json.readTree(files.getValue("manifest.json")).get("requestedBy").asString())
                        .put("reopen_reason", "Revisar los marcajes conservando el acuse anterior.")
                }
            }
        }) { path, manifestHash, fileHash ->
            assertEquals(1, verifier.verify(path, manifestHash, fileHash).at("/counts/closure_acknowledgement").asInt())
        }
    }

    @Test fun `acknowledgement hash uses the exact note historical actor and UTC instant with microseconds`() {
        archive({ files -> acknowledged(files) { rows ->
            val closure = rows.single { it.get("kind").asString() == "week_closure" }.get("data")
            val ack = rows.single { it.get("kind").asString() == "closure_acknowledgement" }.get("data") as ObjectNode
            val actor = UUID.randomUUID().toString()
            val note = "Revisar comida | versión anterior: áéíóú."
            ack.put("type", "objected").put("note", note).put("actor_type", "device").put("actor_id", actor)
                .put("at", "2026-10-12T10:00:00.123456-06:00")
                .put("evidence_hash", sha256("${closure.get("hash").asString()}|objected|$note|2026-10-12T16:00:00.123456Z|device:$actor".toByteArray(Charsets.UTF_8)))
        } }) { path, manifestHash, fileHash -> verifier.verify(path, manifestHash, fileHash) }
    }

    @Test fun `internally rehashed archives cannot hide an inconsistent acknowledgement`() {
        val edits = mapOf("note" to "Otro comentario", "type" to "objected", "at" to "2026-10-12T16:00:00.123457Z",
            "actor_type" to "device", "actor_id" to UUID.randomUUID().toString(), "evidence_hash" to "0".repeat(64))
        for ((field, value) in edits) archive({ files -> acknowledged(files) { rows ->
            (rows.single { it.get("kind").asString() == "closure_acknowledgement" }.get("data") as ObjectNode).put(field, value)
        } }) { path, manifestHash, fileHash ->
            assertFailsWith<IllegalArgumentException>(field) { verifier.verify(path, manifestHash, fileHash) }
        }
    }

    @Test fun `an acknowledgement cannot be attributed to another existing employee`() {
        archive({ files -> acknowledged(files) { rows ->
            val other = rows.last { it.get("kind").asString() == "employee" }.at("/data/id").asString()
            (rows.single { it.get("kind").asString() == "closure_acknowledgement" }.get("data") as ObjectNode).put("employee_id", other)
        } }) { path, manifestHash, fileHash ->
            assertFailsWith<IllegalArgumentException> { verifier.verify(path, manifestHash, fileHash) }
        }
    }

    @Test fun `an acknowledgement cannot be moved to another retained closure version`() {
        archive({ files -> acknowledged(files) { rows ->
            val previous = rows.single { it.get("kind").asString() == "week_closure" }
            val newer = json.readTree(previous.toString()) as ObjectNode
            val id = UUID.randomUUID().toString()
            (newer.get("data") as ObjectNode).put("id", id).put("version", 2).put("snapshot", "{\"version\":2}")
                .put("hash", sha256("{\"version\":2}".toByteArray()))
            rows += newer
            (rows.single { it.get("kind").asString() == "closure_acknowledgement" }.get("data") as ObjectNode).put("closure_id", id)
        } }) { path, manifestHash, fileHash ->
            assertFailsWith<IllegalArgumentException> { verifier.verify(path, manifestHash, fileHash) }
        }
    }

    @Test fun `fixture can be verified and consulted with no database identity or network`() {
        archive { path, manifestHash, fileHash ->
            val manifest = verifier.verify(path, manifestHash, fileHash)
            assertEquals(1, manifest.get("formatVersion").asInt())
            assertFalse(manifest.get("counts").has("tenant_user_site"), "El verificador mantiene expedientes anteriores a sedes por supervisor")
            val users = mutableListOf<String>()
            verifier.consult(path, "tenant_user", users::add)
            assertEquals(1, users.size)
            assertEquals(manifest.get("requestedBy"), json.readTree(users.single()).at("/data/id"))
        }
    }

    @Test fun `supervisor sites preserve old format compatibility and reject foreign duplicate or missing references`() {
        for (problem in listOf("valid", "foreign", "missing_user", "missing_site", "duplicate")) {
            archive({ files ->
                val manifest = json.readTree(files.getValue("manifest.json")) as ObjectNode
                val tenant = manifest.get("tenantId").asString()
                val user = manifest.get("requestedBy").asString()
                val site = UUID.randomUUID().toString()
                val siteRow = """{"kind":"site","tenantId":"$tenant","data":{"id":"$site","name":"Sede ficticia","time_zone":"America/Mexico_City","latitude":19.4,"longitude":-99.1,"radius_m":100,"status":"active","created_at":"2026-11-05T00:00:00Z"}}"""
                val linkTenant = if (problem == "foreign") UUID.randomUUID().toString() else tenant
                val linkUser = if (problem == "missing_user") UUID.randomUUID().toString() else user
                val linkSite = if (problem == "missing_site") UUID.randomUUID().toString() else site
                val link = """{"kind":"tenant_user_site","tenantId":"$linkTenant","data":{"user_id":"$linkUser","site_id":"$linkSite"}}"""
                val copies = if (problem == "duplicate") 2 else 1
                files["records.ndjson"] = files.getValue("records.ndjson") + (siteRow + "\n" + (1..copies).joinToString("\n") { link } + "\n").toByteArray()
                (manifest.get("counts") as ObjectNode).put("site", 1).put("tenant_user_site", copies)
                manifest.get("files").forEach { file -> if (file.get("path").asString() == "records.ndjson") {
                    (file as ObjectNode).put("bytes", files.getValue("records.ndjson").size)
                    file.put("sha256", sha256(files.getValue("records.ndjson")))
                } }
                files["manifest.json"] = (manifest.toString() + "\n").toByteArray()
            }) { path, manifestHash, fileHash ->
                if (problem == "valid") {
                    val manifest = verifier.verify(path, manifestHash, fileHash)
                    assertEquals(1, manifest.at("/counts/tenant_user_site").asInt())
                    val links = mutableListOf<String>()
                    verifier.consult(path, "tenant_user_site", links::add)
                    assertEquals(1, links.size)
                } else assertFailsWith<IllegalArgumentException>(problem) { verifier.verify(path, manifestHash, fileHash) }
            }
        }
    }

    @Test fun `truncation and changes to data or manifest cannot pass the trusted channel hashes`() {
        archive { path, manifestHash, fileHash ->
            assertFailsWith<IllegalArgumentException> { verifier.verify(path, "0".repeat(64), fileHash) }
            val bytes = Files.readAllBytes(path)
            Files.write(path, bytes.copyOf(bytes.size - 20))
            assertFailsWith<IllegalArgumentException> { verifier.verify(path, manifestHash, fileHash) }
            assertFails { verifier.verify(path, manifestHash, sha256(Files.readAllBytes(path))) }
        }
        archive({ files -> files["records.ndjson"] = "alterado\n".toByteArray() }) { path, manifestHash, fileHash ->
            assertFailsWith<IllegalArgumentException> { verifier.verify(path, manifestHash, fileHash) }
        }
        archive({ files -> rewrite(files) { row -> (row.get("data") as ObjectNode).let { if (it.has("display_name")) it.put("display_name", "Cambio") } } }) { path, _, fileHash ->
            assertFailsWith<IllegalArgumentException> { verifier.verify(path, sha256(Files.readAllBytes(fixture.resolve("manifest.json"))), fileHash) }
        }
    }

    @Test fun `coherent internal hashes still reject foreign companies missing references and private fields`() {
        val edits: List<(ObjectNode) -> Unit> = listOf(
            { row -> row.put("tenantId", UUID.randomUUID().toString()) },
            { row -> if (row.get("kind").asString() == "tenant_user") (row.get("data") as ObjectNode).put("employee_id", UUID.randomUUID().toString()) },
            { row -> (row.get("data") as ObjectNode).put("password", "no-es-un-campo-del-formato") },
        )
        for (edit in edits) archive({ files -> rewrite(files, edit) }) { path, manifestHash, fileHash ->
            assertFailsWith<IllegalArgumentException> { verifier.verify(path, manifestHash, fileHash) }
        }
        archive({ files -> files["../fuera.txt"] = "no extraer".toByteArray() }) { path, manifestHash, fileHash ->
            assertFailsWith<IllegalArgumentException> { verifier.verify(path, manifestHash, fileHash) }
        }
    }
}
