package mx.fastsolution.zenit.dossier

import mx.fastsolution.zenit.export.sha256

import tools.jackson.databind.json.JsonMapper
import tools.jackson.databind.node.ObjectNode
import java.io.OutputStream
import java.security.DigestOutputStream
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Lista cerrada del formato 1; nunca descubre tablas o columnas. */
internal data class DossierCollection(val kind: String, val columns: String, val order: String = "id")

internal val dossierCollections = listOf(
    DossierCollection("tenant", "id, slug, name, status, created_at, time_zone, week_starts_on, break_policy, auto_close_after_hours"),
    DossierCollection("tenant_user", "id, display_name, status, employee_id, created_at, linked_at"),
    DossierCollection("tenant_user_role", "user_id, role, granted_at, granted_by", "user_id, role collate \"C\""),
    DossierCollection("site", "id, name, time_zone, latitude, longitude, radius_m, status, created_at"),
    DossierCollection("schedule", "id, name, time_zone, valid_from, valid_to, created_at"),
    DossierCollection("schedule_day", "schedule_id, day_of_week, start_time, end_time, break_minutes", "schedule_id, day_of_week collate \"C\""),
    DossierCollection("employee", "id, external_id, display_name, status, site_id, employment_start, employment_end, source, created_at, updated_at"),
    DossierCollection("schedule_assignment", "id, employee_id, schedule_id, valid_from, valid_to, created_at"),
    DossierCollection("card", "id, label, fingerprint, status, key_version, created_at, updated_at"),
    DossierCollection("card_assignment", "id, card_id, employee_id, since, until, replaced_card_id"),
    DossierCollection("device", "id, mode, status, employee_id, site_id, label, public_jwk, key_thumbprint, manufacturer, model, android_sdk, app_version, enrolled_at, last_seen_at, revoked_at"),
    DossierCollection("device_session", "id, device_id, app_version, started_at, ended_at"),
    DossierCollection("attendance_event", "id, idempotency_key, event_type, declared_type, outcome, observed_at, received_at, time_zone, elapsed_realtime_ms, device_id, device_mode, session_id, sequence, employee_id, card_id, card_scheme, site_id, location_verdict, accuracy_m, envelope, payload_sha256"),
    DossierCollection("location_evidence", "event_id, latitude, longitude, accuracy_m, captured_at, provider, mock", "event_id"),
    DossierCollection("attendance_rejection", "id, idempotency_key, device_id, code, message, observed_at, received_at, payload_sha256"),
    DossierCollection("incident", "id, event_id, employee_id, site_id, type, status, severity, assignee_user_id, resolution_decision, resolution_reason, adjustment_id, resolved_by, resolved_at, created_at"),
    DossierCollection("adjustment", "id, employee_id, kind, event_id, event_type, occurred_at, reason, created_by, created_at"),
    DossierCollection("rule_set", "id, jurisdiction, version, valid_from, valid_to, weekly_ordinary_max_minutes, parameters, sources, created_at"),
    DossierCollection("week_closure", "id, employee_id, week_start, version, status, rule_set_id, rule_set_version, worked_minutes, break_minutes, ordinary_minutes, overtime_minutes, snapshot::text as snapshot, hash, closed_at, closed_by, reopened_at, reopened_by, reopen_reason"),
    DossierCollection("closure_acknowledgement", "id, closure_id, employee_id, type, note, at, actor_type, actor_id, evidence_hash"),
    DossierCollection("week_closure_run", "id, week_start, site_id, origin, status, requested_by, total, closed, blocked_open_incidents, blocked_open_segment, failure, created_at, started_at, finished_at"),
    DossierCollection("week_closure_run_blocked", "run_id, employee_id, reason, incident_ids, created_at", "run_id, employee_id"),
    DossierCollection("audit_log", "id, at, actor_type, actor_id, action, target_type, target_id, correlation_id, metadata"),
).sortedBy { it.kind }

data class DossierArchiveResult(val manifest: String, val manifestSha256: String, val fileSha256: String)

class DossierArchive(private val json: JsonMapper) {
    fun write(
        output: OutputStream, tenantId: UUID, dossierId: UUID, requestedBy: UUID, snapshotAt: String, timeZone: String,
        rows: (String, (String) -> Unit) -> Unit,
    ): DossierArchiveResult {
        val fileDigest = MessageDigest.getInstance("SHA-256")
        val recordDigest = MessageDigest.getInstance("SHA-256")
        val counts = linkedMapOf<String, Long>()
        var recordBytes = 0L
        lateinit var manifest: String
        ZipOutputStream(DigestOutputStream(output, fileDigest), Charsets.UTF_8).use { zip ->
            zip.putNextEntry(ZipEntry("records.ndjson"))
            for (collection in dossierCollections) {
                var count = 0L
                rows(collection.kind) { source ->
                    val data = json.readTree(source) as ObjectNode
                    filter(collection.kind, data)
                    val bytes = (json.writeValueAsString(mapOf("kind" to collection.kind, "tenantId" to tenantId.toString(), "data" to data)) + "\n").toByteArray(Charsets.UTF_8)
                    zip.write(bytes)
                    recordDigest.update(bytes)
                    recordBytes += bytes.size
                    count++
                }
                counts[collection.kind] = count
            }
            zip.closeEntry()
            val instructions = README.toByteArray(Charsets.UTF_8)
            zip.putNextEntry(ZipEntry("README.txt"))
            zip.write(instructions)
            zip.closeEntry()
            manifest = json.writeValueAsString(linkedMapOf(
                "formatVersion" to 1, "dossierId" to dossierId.toString(), "tenantId" to tenantId.toString(), "requestedBy" to requestedBy.toString(),
                "scope" to "all_retained", "snapshotAt" to snapshotAt, "generatedAt" to Instant.now().toString(), "timeZone" to timeZone,
                "files" to listOf(
                    mapOf("path" to "records.ndjson", "bytes" to recordBytes, "sha256" to recordDigest.digest().hex()),
                    mapOf("path" to "README.txt", "bytes" to instructions.size, "sha256" to sha256(instructions)),
                ), "counts" to counts, "limitations" to listOf(
                    "rejected_envelopes_unavailable", "historical_acknowledgement_text_unavailable", "local_android_evidence_not_included", "audit_metadata_filtered",
                ),
            )) + "\n"
            zip.putNextEntry(ZipEntry("manifest.json"))
            zip.write(manifest.toByteArray(Charsets.UTF_8))
            zip.closeEntry()
        }
        return DossierArchiveResult(manifest, sha256(manifest.toByteArray(Charsets.UTF_8)), fileDigest.digest().hex())
    }

    private fun filter(kind: String, data: ObjectNode) {
        if (kind == "audit_log") {
            val metadata = data.get("metadata") as ObjectNode
            metadata.propertyNames().filter { it !in METADATA }.toList().forEach { metadata.remove(it) }
            metadata.propertyNames().toList().filter { !metadata.get(it).isString }.forEach { metadata.remove(it) }
        }
        if (kind == "device") {
            val jwk = data.get("public_jwk") as ObjectNode
            jwk.propertyNames().filter { it !in JWK }.toList().forEach { jwk.remove(it) }
            check(jwk.get("kty")?.asString() == "EC" && jwk.get("crv")?.asString() == "P-256")
            for (coordinate in listOf("x", "y")) check(jwk.get(coordinate)?.asString()?.matches(Regex("^[A-Za-z0-9_-]{43}$")) == true)
            check(!jwk.has("use") || jwk.get("use").asString() == "sig")
            check(!jwk.has("alg") || jwk.get("alg").asString() == "ES256")
            check(!jwk.has("key_ops") || jwk.get("key_ops").let { it.isArray && it.size() <= 1 && it.all { op -> op.asString() == "verify" } })
        }
    }

    companion object {
        private fun ByteArray.hex() = joinToString("") { "%02x".format(it) }
        private val JWK = setOf("kty", "crv", "x", "y", "kid", "use", "alg", "key_ops")
        private val METADATA = setOf("reason", "version", "weekStart", "siteId", "type", "assigned", "decision", "adjustmentId", "adjustment", "fields", "roles", "by", "rows", "fileHash", "closed", "origin", "openIncidents", "openSegment")
        val README = """
            Expediente Zenit, formato 1. Datos conservados de una sola empresa.
            ZIP con manifest.json, README.txt y records.ndjson; UTF-8 sin BOM y LF.
            Consultar JSON como texto/datos, nunca ejecutar fórmulas, HTML o código.
            Cada línea de records.ndjson tiene kind, tenantId y data. null indica ausencia.
            Los instantes son UTC; timeZone del manifiesto indica la zona de consulta.
            Leer enteros con precisión entera, sin convertirlos a Number de JavaScript.
            Verificar inventario exacto, tamaños y SHA-256 contra manifest.json.
            Comparar además manifestSha256 y fileSha256 con el canal autorizado del API.
            Contar filas por kind, comparar counts y comprobar tenantId, llaves y referencias.
            Las relaciones usan IDs de la misma empresa; rule_set contiene reglas públicas.
            Actores/objetivos históricos de auditoría pueden estar desvinculados: sus IDs se conservan.
            Se incluyen bajas y versiones reabiertas, ajustes, objeciones y acuses históricos.
            snapshot y envelope conservan su texto original: no reformatearlo ni recalcular evidencia.
            No se incluyen contraseñas, correos/subjects OIDC, tokens ni claves privadas/de tarjetas.
            Los sobres originales de rechazos no existen en servidor y no se reconstruyen.
            No se incluye evidencia que sólo permanezca en Android ni texto histórico del acuse no guardado.
            La metadata de auditoría está filtrada por lista permitida.
            Alterar simultáneamente datos y manifiesto puede eludir la verificación interna.
            Las huellas no acreditan firma avanzada, sello de tiempo ni certificación jurídica.
            Verificar y consultar sin Zenit antes de aceptar la salida del servicio.
            Descargar o verificar no autoriza borrado de servidor ni purga Android.
        """.trimIndent() + "\n"
    }
}

/** Sólo retiene 64 KiB; close entrega el último bloque, sin materializar el ZIP. */
internal class DossierChunkOutput(private val put: (Int, ByteArray) -> Unit) : OutputStream() {
    private val buffer = ByteArray(65536)
    private var used = 0
    private var position = 0
    private var closed = false

    override fun write(value: Int) { write(byteArrayOf(value.toByte()), 0, 1) }

    override fun write(bytes: ByteArray, offset: Int, length: Int) {
        check(!closed)
        java.util.Objects.checkFromIndexSize(offset, length, bytes.size)
        var at = offset
        var left = length
        while (left > 0) {
            val size = minOf(left, buffer.size - used)
            bytes.copyInto(buffer, used, at, at + size)
            used += size
            at += size
            left -= size
            if (used == buffer.size) flush()
        }
    }

    override fun flush() {
        if (used > 0) {
            put(position++, buffer.copyOf(used))
            used = 0
        }
    }

    override fun close() { if (!closed) { flush(); closed = true } }
}
