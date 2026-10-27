package mx.fastsolution.zenit

import mx.fastsolution.zenit.export.sha256

import com.networknt.schema.InputFormat
import com.networknt.schema.SchemaLocation
import com.networknt.schema.SchemaRegistry
import com.networknt.schema.dialect.Dialects
import mx.fastsolution.zenit.dossier.DossierArchive
import mx.fastsolution.zenit.dossier.DossierChunkOutput
import mx.fastsolution.zenit.dossier.dossierCollections
import tools.jackson.databind.json.JsonMapper
import tools.jackson.dataformat.yaml.YAMLMapper
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import java.util.zip.ZipInputStream
import kotlin.random.Random
import kotlin.test.*

class DossierArchiveTest {
    private val json = JsonMapper()
    private val directory = Path.of(System.getProperty("zenit.contractsDirectory"))
    private val format = YAMLMapper().readTree(Files.readString(directory.resolve("dossier-format.schema.yaml")))
    private val registry = SchemaRegistry.withDialect(Dialects.getDraft202012()) {
        it.schemas(mapOf("https://zenit.invalid/format.yaml" to Files.readString(directory.resolve("dossier-format.schema.yaml"))))
    }

    @Test
    fun `format field inventory matches every explicitly selected column without secrets`() {
        assertEquals(23, dossierCollections.size)
        for (collection in dossierCollections) {
            val expected = format.at("/\$defs/${collection.kind}/properties/data/required").asSequence().map { it.asString() }.toSet()
            val selected = collection.columns.split(", ").map { it.substringAfterLast(" as ") }.toSet()
            assertEquals(expected, selected, collection.kind)
            assertFalse("*" in collection.columns)
        }
        assertEquals(dossierCollections.map { it.kind }.sorted(), dossierCollections.map { it.kind })
    }

    @Test
    fun `archive preserves fixture records and hashes all three exact UTF8 files`() {
        val fixture = Files.readAllLines(directory.resolve("examples/dossier-v1/records.ndjson")).map { json.readTree(it) }
        val tenant = UUID.fromString(fixture.first().get("tenantId").asString())
        val output = ByteArrayOutputStream()
        val result = DossierArchive(json).write(output, tenant, UUID.randomUUID(), UUID.randomUUID(), "2026-10-27T00:00:00Z", "America/Mexico_City") { kind, emit ->
            fixture.filter { it.get("kind").asString() == kind }.forEach { emit(it.get("data").toString()) }
        }
        val files = linkedMapOf<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(output.toByteArray())).use { zip ->
            while (true) { val entry = zip.nextEntry ?: break; assertFalse(entry.isDirectory); assertNull(files.put(entry.name, zip.readAllBytes())) }
        }
        assertEquals(setOf("manifest.json", "README.txt", "records.ndjson"), files.keys)
        assertEquals(result.manifest, files.getValue("manifest.json").toString(Charsets.UTF_8))
        assertEquals(result.fileSha256, sha256(output.toByteArray()))
        assertEquals(result.manifestSha256, sha256(files.getValue("manifest.json")))
        val manifest = json.readTree(result.manifest)
        assertEquals(emptyList(), registry.getSchema(SchemaLocation.of("https://zenit.invalid/format.yaml#/\$defs/Manifest")).validate(result.manifest, InputFormat.JSON))
        for (file in manifest.get("files")) {
            val bytes = files.getValue(file.get("path").asString())
            assertEquals(file.get("sha256").asString(), sha256(bytes))
            assertEquals(file.get("bytes").asLong(), bytes.size.toLong())
        }
        val rows = files.getValue("records.ndjson").toString(Charsets.UTF_8).lineSequence().filter { it.isNotEmpty() }.map { json.readTree(it) }.toList()
        assertEquals(fixture.toSet(), rows.toSet())
        for (kind in dossierCollections.map { it.kind }) assertEquals(rows.count { it.get("kind").asString() == kind }.toLong(), manifest.get("counts").get(kind).asLong())
        files.forEach { (name, bytes) -> assertEquals(10.toByte(), bytes.last(), name); assertFalse(13.toByte() in bytes, name) }
    }

    @Test
    fun `chunks preserve arbitrary writes and never exceed 64 KiB including exact boundaries`() {
        for (size in listOf(0, 1, 65535, 65536, 65537, 200003)) {
            val source = Random(size).nextBytes(size)
            val chunks = mutableListOf<ByteArray>()
            val stream = DossierChunkOutput { position, bytes -> assertEquals(chunks.size, position); assertTrue(bytes.size in 1..65536); chunks += bytes }
            var at = 0
            while (at < size) { val count = minOf(7777, size - at); stream.write(source, at, count); at += count }
            stream.close()
            stream.close()
            val joined = ByteArrayOutputStream().apply { chunks.forEach { write(it) } }.toByteArray()
            assertContentEquals(source, joined)
            assertFailsWith<IllegalStateException> { stream.write(1) }
        }
    }

    @Test
    fun `private JWK properties and nonallowlisted audit metadata cannot leave the archive`() {
        val output = ByteArrayOutputStream()
        val coordinate = "A".repeat(43)
        DossierArchive(json).write(output, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "2026-10-27T00:00:00Z", "UTC") { kind, emit ->
            if (kind == "device") emit("""{"public_jwk":{"kty":"EC","crv":"P-256","x":"$coordinate","y":"$coordinate","d":"PRIVATE_SENTINEL"}}""")
            if (kind == "audit_log") emit("""{"metadata":{"reason":"Motivo conservado","token":"TOKEN_SENTINEL","rows":42}}""")
        }
        ZipInputStream(ByteArrayInputStream(output.toByteArray())).use { zip ->
            assertEquals("records.ndjson", zip.nextEntry.name)
            val text = zip.readAllBytes().toString(Charsets.UTF_8)
            assertFalse("PRIVATE_SENTINEL" in text || "TOKEN_SENTINEL" in text || "\"rows\"" in text)
            assertTrue("Motivo conservado" in text)
        }
        assertFailsWith<IllegalStateException> {
            DossierArchive(json).write(ByteArrayOutputStream(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "2026-10-27T00:00:00Z", "UTC") { kind, emit ->
                if (kind == "device") emit("""{"public_jwk":{"kty":"RSA","crv":"P-256","x":"$coordinate","y":"$coordinate"}}""")
            }
        }
    }
}
