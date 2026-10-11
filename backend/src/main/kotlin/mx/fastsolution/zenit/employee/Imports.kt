package mx.fastsolution.zenit.employee

import com.fasterxml.jackson.annotation.JsonRawValue
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.site.SiteRepository
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.UUID

data class ImportRow(
    val id: UUID,
    val contentSha256: String,
    val dryRun: Boolean,
    val status: String,
    val templateVersion: Int,
    val total: Int,
    val accepted: Int,
    val rejected: Int,
    /** JSON tal como lo guarda la base. */
    val errors: String,
    val manifestHash: String?,
    val createdAt: OffsetDateTime,
)

data class ImportCounts(val total: Int, val accepted: Int, val rejected: Int)

data class ImportView(
    val id: String,
    val status: String,
    val dryRun: Boolean,
    val templateVersion: Int,
    val counts: ImportCounts,
    @get:JsonRawValue val errors: String,
    val manifestHash: String?,
    val createdAt: String,
) {
    companion object {
        fun of(row: ImportRow) = ImportView(
            row.id.toString(), row.status, row.dryRun, row.templateVersion,
            ImportCounts(row.total, row.accepted, row.rejected), row.errors, row.manifestHash,
            row.createdAt.toInstant().toString(),
        )
    }
}

data class RowError(val row: Int, val externalId: String?, val code: String, val message: String)

/** Fila del archivo que sí entra al padrón. */
data class AcceptedRow(val externalId: String, val displayName: String, val employmentStart: LocalDate, val siteId: UUID?)

data class ParsedFile(val total: Int, val accepted: List<AcceptedRow>, val errors: List<RowError>, val structural: Boolean)

@Repository
class ImportRepository(private val dsl: DSLContext) {
    fun insert(tenantId: UUID, row: ImportRow, idempotencyKey: UUID, createdBy: String) {
        dsl.execute(
            "insert into employee_import (tenant_id, id, idempotency_key, content_sha256, dry_run, status, template_version, " +
                "total, accepted, rejected, errors, manifest_hash, created_by) " +
                "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as text), ?)",
            tenantId, row.id, idempotencyKey, row.contentSha256, row.dryRun, row.status, row.templateVersion,
            row.total, row.accepted, row.rejected, row.errors, row.manifestHash, createdBy,
        )
    }

    fun find(tenantId: UUID, id: UUID): ImportRow? =
        dsl.fetchOne("select $COLUMNS from employee_import where tenant_id = ? and id = ?", tenantId, id)?.let(::row)

    fun findByKey(tenantId: UUID, idempotencyKey: UUID): ImportRow? =
        dsl.fetchOne("select $COLUMNS from employee_import where tenant_id = ? and idempotency_key = ?", tenantId, idempotencyKey)
            ?.let(::row)

    private fun row(r: Record) = ImportRow(
        id = r.get("id", UUID::class.java),
        contentSha256 = r.get("content_sha256", String::class.java),
        dryRun = r.get("dry_run", Boolean::class.javaObjectType),
        status = r.get("status", String::class.java),
        templateVersion = r.get("template_version", Number::class.java).toInt(),
        total = r.get("total", Number::class.java).toInt(),
        accepted = r.get("accepted", Number::class.java).toInt(),
        rejected = r.get("rejected", Number::class.java).toInt(),
        errors = r.get("errors", String::class.java),
        manifestHash = r.get("manifest_hash", String::class.java)?.trim(),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
    )

    private companion object {
        const val COLUMNS =
            "id, cast(content_sha256 as text) as content_sha256, dry_run, status, template_version, total, accepted, " +
                "rejected, cast(errors as text) as errors, cast(manifest_hash as text) as manifest_hash, created_at"
    }
}

/**
 * Importación del padrón desde CSV. Se procesa en la misma petición: el padrón
 * de una empresa cabe de sobra en el límite del archivo. No guarda el archivo;
 * conserva su huella, los conteos y las filas rechazadas.
 */
@Service
class ImportService(
    private val imports: ImportRepository,
    private val employees: EmployeeRepository,
    private val sites: SiteRepository,
    private val audit: AuditLog,
) {
    @Transactional
    fun run(person: CurrentPerson, idempotencyKey: UUID, content: ByteArray, dryRun: Boolean): ImportRow {
        val tenantId = person.requireTenant()
        val sha = sha256(content)
        // La misma clave nunca crea dos resultados.
        imports.findByKey(tenantId, idempotencyKey)?.let { return replay(it, sha, dryRun) }

        val parsed = parse(tenantId, content)
        val manifest = parsed.accepted
            .joinToString("\n") { "${it.externalId}|${it.displayName}|${it.employmentStart}|${it.siteId ?: ""}" }
        val row = ImportRow(
            id = UUID.randomUUID(),
            contentSha256 = sha,
            dryRun = dryRun,
            status = when {
                parsed.structural -> "failed"
                dryRun -> "ready"
                else -> "applied"
            },
            templateVersion = TEMPLATE_VERSION,
            total = parsed.total,
            accepted = parsed.accepted.size,
            rejected = parsed.errors.size.coerceAtMost(parsed.total),
            errors = errorsJson(parsed.errors),
            manifestHash = if (parsed.structural) null else sha256(manifest.toByteArray()),
            createdAt = OffsetDateTime.now(),
        )
        try {
            imports.insert(tenantId, row, idempotencyKey, person.actorId)
        } catch (e: RuntimeException) {
            // Otra petición con la misma clave ganó; el cliente reintenta y recibe su resultado.
            throw if (Conflicts.uniqueConstraint(e) == Conflicts.IMPORT_IDEMPOTENCY) idempotencyConflict() else e
        }
        if (row.status == "applied") apply(tenantId, parsed.accepted)
        audit.record(
            tenantId, person, "import.${row.status}", "import", row.id,
            mapOf("total" to row.total.toString(), "accepted" to row.accepted.toString(), "rejected" to row.rejected.toString()),
        )
        return imports.find(tenantId, row.id)!!
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): ImportRow = imports.find(person.requireTenant(), id) ?: throw Problems.notFound()

    private fun replay(existing: ImportRow, sha: String, dryRun: Boolean): ImportRow {
        if (existing.contentSha256 != sha || existing.dryRun != dryRun) throw idempotencyConflict()
        return existing
    }

    private fun idempotencyConflict() = Problems.conflict("idempotency_conflict", "La clave de idempotencia ya se usó con otro contenido.")

    /** Alta o actualización por identificador externo: repetir el archivo no duplica a nadie. */
    private fun apply(tenantId: UUID, rows: List<AcceptedRow>) {
        for (row in rows) {
            val existing = employees.findByExternalId(tenantId, row.externalId)
            if (existing == null) {
                try {
                    employees.insert(tenantId, UUID.randomUUID(), row.externalId, row.displayName, row.siteId, row.employmentStart, "csv")
                } catch (e: RuntimeException) {
                    // Alguien dio de alta a esa persona mientras corría la importación.
                    throw if (Conflicts.uniqueConstraint(e) == Conflicts.EMPLOYEE_EXTERNAL_ID) Conflicts.externalIdTaken() else e
                }
            } else if (existing.displayName != row.displayName || existing.siteId != row.siteId || existing.employmentStart != row.employmentStart) {
                employees.update(
                    tenantId, existing.id, row.displayName, row.siteId, existing.status, row.employmentStart, existing.employmentEnd,
                )
            }
        }
    }

    private fun parse(tenantId: UUID, content: ByteArray): ParsedFile {
        val text = decode(content) ?: return structural("invalid_encoding", "El archivo no está en UTF-8.")
        val lines = Csv.parse(text)
        if (lines.isEmpty()) return structural("empty_file", "El archivo no tiene encabezados.")
        val header = lines.first().second.map { it.trim() }
        if (header != HEADERS) {
            return structural("invalid_header", "Los encabezados deben ser: ${HEADERS.joinToString(",")}.")
        }
        val data = lines.drop(1)
        if (data.size > MAX_ROWS) return structural("too_many_rows", "Admite hasta $MAX_ROWS filas.")

        val accepted = mutableListOf<AcceptedRow>()
        val errors = mutableListOf<RowError>()
        val seen = mutableSetOf<String>()
        for ((line, fields) in data) {
            val externalId = fields.getOrNull(0)?.trim().orEmpty()
            val displayName = fields.getOrNull(1)?.trim().orEmpty()
            val startText = fields.getOrNull(2)?.trim().orEmpty()
            val siteName = fields.getOrNull(3)?.trim().orEmpty()
            val known = externalId.ifEmpty { null }
            val start = try {
                LocalDate.parse(startText)
            } catch (e: DateTimeParseException) {
                null
            }
            val siteIds = if (siteName.isEmpty()) emptyList() else sites.activeByName(tenantId, siteName)
            val error = when {
                fields.size != HEADERS.size -> "wrong_column_count" to "La fila debe tener ${HEADERS.size} columnas."
                externalId.isEmpty() -> "missing_external_id" to "Falta el identificador externo."
                externalId.length > MAX_EXTERNAL_ID -> "external_id_too_long" to "El identificador admite hasta $MAX_EXTERNAL_ID caracteres."
                !seen.add(externalId) -> "duplicate_in_file" to "El identificador se repite en el archivo."
                displayName.isEmpty() -> "missing_display_name" to "Falta el nombre."
                displayName.length > MAX_NAME -> "display_name_too_long" to "El nombre admite hasta $MAX_NAME caracteres."
                start == null -> "invalid_date" to "La fecha de inicio debe ser AAAA-MM-DD."
                siteName.isNotEmpty() && siteIds.isEmpty() -> "site_not_found" to "No hay una sede activa con ese nombre."
                siteIds.size > 1 -> "site_ambiguous" to "Hay más de una sede activa con ese nombre."
                else -> null
            }
            if (error != null) {
                errors += RowError(line, known?.take(MAX_EXTERNAL_ID), error.first, error.second)
            } else {
                accepted += AcceptedRow(externalId, displayName, start!!, siteIds.firstOrNull())
            }
        }
        return ParsedFile(data.size, accepted, errors, structural = false)
    }

    private fun structural(code: String, message: String) =
        ParsedFile(0, emptyList(), listOf(RowError(1, null, code, message)), structural = true)

    private fun decode(content: ByteArray): String? = try {
        Charsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(content))
            .toString()
    } catch (e: CharacterCodingException) {
        null
    }

    private fun errorsJson(errors: List<RowError>): String = errors.joinToString(",", "[", "]") {
        val externalId = it.externalId?.let(AuditLog::quote) ?: "null"
        "{\"row\":${it.row},\"externalId\":$externalId,\"code\":${AuditLog.quote(it.code)},\"message\":${AuditLog.quote(it.message)}}"
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    companion object {
        const val TEMPLATE_VERSION = 1
        const val MAX_ROWS = 5000
        const val MAX_EXTERNAL_ID = 64
        const val MAX_NAME = 160

        /** Plantilla vigente. Cambiar los encabezados sube la versión. */
        val HEADERS = listOf("external_id", "display_name", "employment_start", "site_name")
    }
}

@RestController
@RequestMapping("/api/v1/imports")
class ImportController(private val service: ImportService) {
    @PostMapping("/csv")
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun importCsv(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestParam("file", required = false) file: MultipartFile?,
        @RequestParam("dryRun", required = false) dryRun: String?,
    ): ImportView {
        val key = try {
            UUID.fromString(idempotencyKey ?: "")
        } catch (e: IllegalArgumentException) {
            throw Problems.validation("Idempotency-Key", "invalid_identifier", "La cabecera Idempotency-Key debe ser un UUID.")
        }
        if (file == null || file.isEmpty) throw Problems.validation("file", "required", "Falta el archivo.")
        // Sin indicarlo sólo se valida: aplicar es una decisión explícita.
        val dry = when (dryRun) {
            null, "true" -> true
            "false" -> false
            else -> throw Problems.validation("dryRun", "invalid_value", "Debe ser true o false.")
        }
        return ImportView.of(service.run(person, key, file.bytes, dry))
    }

    @GetMapping("/{importId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable importId: UUID): ImportView =
        ImportView.of(service.get(person, importId))
}
