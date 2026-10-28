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

    @Test fun `fixture can be verified and consulted with no database identity or network`() {
        archive { path, manifestHash, fileHash ->
            val manifest = verifier.verify(path, manifestHash, fileHash)
            assertEquals(1, manifest.get("formatVersion").asInt())
            val users = mutableListOf<String>()
            verifier.consult(path, "tenant_user", users::add)
            assertEquals(1, users.size)
            assertEquals(manifest.get("requestedBy"), json.readTree(users.single()).at("/data/id"))
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
