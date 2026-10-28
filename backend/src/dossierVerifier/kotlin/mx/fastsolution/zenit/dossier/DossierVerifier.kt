package mx.fastsolution.zenit.dossier

import com.networknt.schema.ExecutionContext
import com.networknt.schema.InputFormat
import com.networknt.schema.SchemaLocation
import com.networknt.schema.SchemaRegistry
import com.networknt.schema.dialect.Dialects
import tools.jackson.core.StreamReadFeature
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.time.ZoneId
import java.util.function.Consumer
import java.util.zip.ZipFile
import kotlin.system.exitProcess

/** Verifica antes de consultar; las huellas esperadas deben venir del canal autorizado. */
class DossierVerifier {
    private val json = JsonMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build()
    private val schemaText = javaClass.getResourceAsStream("/dossier-format.schema.yaml")!!.bufferedReader().use { it.readText() }
    private val schemaUrl = "https://zenit.invalid/contrato/dossier-format.schema.yaml"
    private val registry = SchemaRegistry.withDialects(listOf(Dialects.getDraft202012())) { it.schemas(mapOf(schemaUrl to schemaText)) }
    private val manifestSchema = registry.getSchema(SchemaLocation.of("$schemaUrl#/${'$'}defs/Manifest"))
    private val recordSchemas = primary.keys.associateWith { registry.getSchema(SchemaLocation.of("$schemaUrl#/${'$'}defs/$it")) }

    fun verify(path: Path, manifestHash: String, fileHash: String): JsonNode {
        require(listOf(manifestHash, fileHash).all { it.matches(Regex("^[a-f0-9]{64}$")) }) { "Se requieren las dos huellas SHA-256 del canal autorizado." }
        require(Files.newInputStream(path).use { digest(it) } == fileHash) { "La huella del ZIP no coincide." }
        ZipFile(path.toFile()).use { zip ->
            val names = zip.entries().asSequence().map { it.name }.toList()
            require(names.size == 3 && names.toSet() == setOf("manifest.json", "README.txt", "records.ndjson")) { "Inventario ZIP incorrecto o duplicado." }
            val bytes = zip.getInputStream(zip.getEntry("manifest.json")).use { it.readNBytes(1_048_577) }
            require(bytes.size <= 1_048_576 && hash(bytes) == manifestHash) { "El manifiesto no coincide con el canal autorizado." }
            val manifest = json.readTree(bytes)
            valid(manifestSchema.validate(manifest.toString(), InputFormat.JSON, formats()))
            ZoneId.of(manifest.get("timeZone").asString())
            for (file in manifest.get("files")) {
                val entry = zip.getEntry(file.get("path").asString())
                require(entry.size == file.get("bytes").asLong()) { "Tamaño declarado incorrecto." }
                require(zip.getInputStream(entry).use { digest(it) } == file.get("sha256").asString()) { "Contenido alterado." }
            }
            // shortcut: sólo los índices de IDs viven en memoria; pasar a índice en disco si el histórico excede la memoria disponible.
            val ids = mutableMapOf<String, MutableSet<String>>()
            val counts = manifest.get("counts").properties().associate { it.key to 0L }.toMutableMap()
            records(zip) { row ->
                val kind = row.get("kind")?.takeIf { it.isString }?.asString()
                val schema = recordSchemas[kind] ?: throw IllegalArgumentException("Colección desconocida.")
                valid(schema.validate(row.toString(), InputFormat.JSON, formats()))
                require(row.get("tenantId") == manifest.get("tenantId")) { "Registro de otra empresa." }
                require(kind != null)
                val data = row.get("data")
                val key = primary.getValue(kind).joinToString(":") { data.get(it).asString() }
                require(ids.getOrPut(kind) { mutableSetOf() }.add(key)) { "Identificador duplicado en $kind." }
                counts[kind] = counts.getValue(kind) + 1
                if (kind == "tenant") require(data.get("id") == manifest.get("tenantId")) { "Empresa incoherente." }
                if (kind == "week_closure") require(hash(data.get("snapshot").asString().toByteArray(Charsets.UTF_8)) == data.get("hash").asString()) { "Snapshot de cierre alterado." }
            }
            require(counts.all { (kind, n) -> n == manifest.get("counts").get(kind).asLong() } && counts["tenant"] == 1L) { "Conteos incompletos." }
            require(manifest.get("requestedBy").asString() in ids["tenant_user"].orEmpty()) { "Solicitante ausente." }
            records(zip) { row ->
                val kind = row.get("kind").asString()
                val data = row.get("data")
                for ((field, target) in references[kind].orEmpty()) {
                    val value = data.get(field)
                    if (value != null && !value.isNull) require(value.asString() in ids[target].orEmpty()) { "Referencia ausente: $kind.$field." }
                }
                if (kind == "week_closure_run_blocked") for (id in data.get("incident_ids")) require(id.asString() in ids["incident"].orEmpty()) { "Incidencia bloqueada ausente." }
            }
            return manifest
        }
    }

    fun consult(path: Path, kind: String, emit: (String) -> Unit) {
        require(kind in primary) { "Colección desconocida." }
        ZipFile(path.toFile()).use { zip -> records(zip) { row -> if (row.get("kind").asString() == kind) emit(row.toString()) } }
    }

    private fun records(zip: ZipFile, accept: (JsonNode) -> Unit) {
        java.io.InputStreamReader(zip.getInputStream(zip.getEntry("records.ndjson")), Charsets.UTF_8.newDecoder()).buffered().use { reader ->
            reader.lineSequence().forEach { line -> require(line.isNotBlank()) { "Línea NDJSON vacía." }; accept(json.readTree(line)) }
        }
    }
    private fun valid(errors: List<*>) { require(errors.isEmpty()) { "El archivo no cumple el esquema del formato 1." } }
    private fun formats() = Consumer<ExecutionContext> { context -> context.executionConfig { it.formatAssertionsEnabled(true) } }
    private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private fun digest(input: java.io.InputStream): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(65536)
        while (true) { val size = input.read(buffer); if (size < 0) break; digest.update(buffer, 0, size) }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
    companion object {
        private val primary = ("tenant tenant_user site schedule employee schedule_assignment card card_assignment device device_session attendance_event attendance_rejection incident adjustment rule_set week_closure closure_acknowledgement week_closure_run audit_log"
            .split(' ').associateWith { listOf("id") } + mapOf("tenant_user_role" to listOf("user_id", "role"), "schedule_day" to listOf("schedule_id", "day_of_week"), "location_evidence" to listOf("event_id"), "week_closure_run_blocked" to listOf("run_id", "employee_id")))
        private val references = mapOf(
            "tenant_user" to mapOf("employee_id" to "employee"), "tenant_user_role" to mapOf("user_id" to "tenant_user"),
            "schedule_day" to mapOf("schedule_id" to "schedule"), "employee" to mapOf("site_id" to "site"),
            "schedule_assignment" to mapOf("employee_id" to "employee", "schedule_id" to "schedule"),
            "card_assignment" to mapOf("card_id" to "card", "employee_id" to "employee", "replaced_card_id" to "card"),
            "device" to mapOf("employee_id" to "employee", "site_id" to "site"), "device_session" to mapOf("device_id" to "device"),
            "attendance_event" to mapOf("device_id" to "device", "session_id" to "device_session", "employee_id" to "employee", "card_id" to "card", "site_id" to "site"),
            "location_evidence" to mapOf("event_id" to "attendance_event"), "attendance_rejection" to mapOf("device_id" to "device"),
            "incident" to mapOf("event_id" to "attendance_event", "employee_id" to "employee", "site_id" to "site", "assignee_user_id" to "tenant_user", "resolved_by" to "tenant_user", "adjustment_id" to "adjustment"),
            "adjustment" to mapOf("employee_id" to "employee", "event_id" to "attendance_event"),
            "week_closure" to mapOf("employee_id" to "employee", "rule_set_id" to "rule_set", "closed_by" to "tenant_user", "reopened_by" to "tenant_user"),
            "closure_acknowledgement" to mapOf("closure_id" to "week_closure", "employee_id" to "employee"),
            "week_closure_run" to mapOf("site_id" to "site", "requested_by" to "tenant_user"), "week_closure_run_blocked" to mapOf("run_id" to "week_closure_run", "employee_id" to "employee"),
        )
    }
}

fun main(args: Array<String>) {
    try {
        require(args.size in 3..4) { "Uso: java -jar verificar-expediente.jar ZIP MANIFEST_SHA256 FILE_SHA256 [colección]" }
        val verifier = DossierVerifier()
        val path = Path.of(args[0])
        val manifest = verifier.verify(path, args[1], args[2])
        if (args.size == 4) verifier.consult(path, args[3], ::println) else println(manifest)
    } catch (failure: Exception) {
        System.err.println("Expediente rechazado: ${failure.message?.take(240)}")
        exitProcess(1)
    }
}
