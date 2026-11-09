package mx.fastsolution.zenit.employee

import com.fasterxml.jackson.annotation.JsonRawValue
import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.integration.SourceRepository
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
    val fileName: String? = null,
    val reviewedImportId: UUID? = null,
    /** Lo que sólo se lee de la base: quién la subió y, si fue una revisión, la importación que la aplicó. */
    val createdBy: String? = null,
    val createdByName: String? = null,
    val appliedByImportId: UUID? = null,
    /** Qué hacen las filas aceptadas en el padrón; nulo en las importaciones anteriores a 0.29.0. */
    val created: Int? = null,
    val updated: Int? = null,
    val unchanged: Int? = null,
)

data class ImportCounts(val total: Int, val accepted: Int, val rejected: Int, val created: Int?, val updated: Int?, val unchanged: Int?)

data class ImportView(
    val id: String,
    val status: String,
    val dryRun: Boolean,
    val templateVersion: Int,
    val counts: ImportCounts,
    @get:JsonRawValue val errors: String,
    val manifestHash: String?,
    val fileName: String?,
    val createdBy: String?,
    val createdByName: String?,
    val reviewedImportId: String?,
    val appliedByImportId: String?,
    val createdAt: String,
) {
    companion object {
        fun of(row: ImportRow) = ImportView(
            row.id.toString(), row.status, row.dryRun, row.templateVersion,
            ImportCounts(row.total, row.accepted, row.rejected, row.created, row.updated, row.unchanged), row.errors, row.manifestHash,
            row.fileName,
            // Quien la subió es una persona de la empresa; otro actor no se expone como identificador.
            row.createdBy?.takeIf { runCatching { UUID.fromString(it) }.isSuccess },
            row.createdByName, row.reviewedImportId?.toString(), row.appliedByImportId?.toString(),
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
                "total, accepted, rejected, errors, manifest_hash, created_by, file_name, reviewed_import_id, created, updated, unchanged) " +
                "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as text), ?, cast(? as text), cast(? as uuid), " +
                "cast(? as integer), cast(? as integer), cast(? as integer))",
            tenantId, row.id, idempotencyKey, row.contentSha256, row.dryRun, row.status, row.templateVersion,
            row.total, row.accepted, row.rejected, row.errors, row.manifestHash, createdBy, row.fileName, row.reviewedImportId,
            row.created, row.updated, row.unchanged,
        )
    }

    fun find(tenantId: UUID, id: UUID): ImportRow? =
        dsl.fetchOne("$SELECT where i.tenant_id = ? and i.id = ?", tenantId, id)?.let(::row)

    fun findByKey(tenantId: UUID, idempotencyKey: UUID): ImportRow? =
        dsl.fetchOne("$SELECT where i.tenant_id = ? and i.idempotency_key = ?", tenantId, idempotencyKey)?.let(::row)

    /** De la más reciente a la más antigua. */
    fun page(tenantId: UUID, status: String?, after: PageKey?, limit: Int): List<ImportRow> {
        val sql = StringBuilder("$SELECT where i.tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (status != null) {
            sql.append(" and i.status = ?")
            binds += status
        }
        if (after != null) {
            sql.append(" and (i.created_at, i.id) < (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by i.created_at desc, i.id desc limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { row(it) }
    }

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
        fileName = r.get("file_name", String::class.java),
        reviewedImportId = r.get("reviewed_import_id", UUID::class.java),
        createdBy = r.get("created_by", String::class.java),
        createdByName = r.get("created_by_name", String::class.java),
        appliedByImportId = r.get("applied_by_import_id", UUID::class.java),
        created = r.get("created", Number::class.java)?.toInt(),
        updated = r.get("updated", Number::class.java)?.toInt(),
        unchanged = r.get("unchanged", Number::class.java)?.toInt(),
    )

    private companion object {
        // Quien la subió se compara como texto: `created_by` guarda el actor, que no siempre es un UUID.
        const val SELECT =
            "select i.id, cast(i.content_sha256 as text) as content_sha256, i.dry_run, i.status, i.template_version, i.total, " +
                "i.accepted, i.rejected, cast(i.errors as text) as errors, cast(i.manifest_hash as text) as manifest_hash, " +
                "i.created_at, i.file_name, i.reviewed_import_id, i.created, i.updated, i.unchanged, i.created_by, nullif(u.display_name, '') as created_by_name, " +
                "(select a.id from employee_import a where a.tenant_id = i.tenant_id and a.reviewed_import_id = i.id) " +
                "as applied_by_import_id from employee_import i " +
                "left join tenant_user u on u.tenant_id = i.tenant_id and cast(u.id as text) = i.created_by"
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
    private val sources: SourceRepository,
    private val audit: AuditLog,
) {
    /**
     * Valida o aplica un archivo. `reviewedImportId` aplica una revisión
     * anterior: el archivo tiene que ser el mismo que se revisó, byte por byte,
     * porque el servidor no lo conserva; sólo compara su huella.
     */
    @Transactional
    fun run(
        person: CurrentPerson,
        idempotencyKey: UUID,
        content: ByteArray,
        dryRun: Boolean,
        fileName: String? = null,
        reviewedImportId: UUID? = null,
    ): ImportRow {
        val tenantId = person.requireTenant()
        val sha = sha256(content)
        // La misma clave nunca crea dos resultados.
        imports.findByKey(tenantId, idempotencyKey)?.let { return replay(it, sha, dryRun, reviewedImportId) }
        if (reviewedImportId != null) checkReview(tenantId, reviewedImportId, sha, dryRun)

        val parsed = parse(tenantId, content)
        // Lo que cada fila aceptada hará en el padrón; una revisión lo anticipa y una aplicación lo hace.
        val plan = parsed.accepted.map { it to employees.findByExternalId(tenantId, it.externalId) }
        val changes = plan.groupingBy { (row, existing) -> change(row, existing) }.eachCount()
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
            fileName = cleanFileName(fileName),
            reviewedImportId = reviewedImportId,
            created = changes[Change.CREATED] ?: 0,
            updated = changes[Change.UPDATED] ?: 0,
            unchanged = changes[Change.UNCHANGED] ?: 0,
        )
        try {
            imports.insert(tenantId, row, idempotencyKey, person.actorId)
        } catch (e: RuntimeException) {
            throw when (Conflicts.uniqueConstraint(e)) {
                // Otra petición con la misma clave ganó; el cliente reintenta y recibe su resultado.
                Conflicts.IMPORT_IDEMPOTENCY -> idempotencyConflict()
                // Otra petición aplicó la misma revisión al mismo tiempo.
                Conflicts.IMPORT_REVIEW -> reviewAlreadyApplied()
                else -> e
            }
        }
        if (row.status == "applied") {
            apply(tenantId, plan)
            // La carga aplicada es el nuevo punto de sincronización de la fuente CSV.
            sources.recordCsv(tenantId, row.id, TEMPLATE_VERSION)
        }
        audit.record(
            tenantId, person, "import.${row.status}", "import", row.id,
            mapOf("total" to row.total.toString(), "accepted" to row.accepted.toString(), "rejected" to row.rejected.toString()),
        )
        return imports.find(tenantId, row.id)!!
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): ImportRow = imports.find(person.requireTenant(), id) ?: throw Problems.notFound()

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, status: String?, after: PageKey?, limit: Int): List<ImportRow> {
        val checks = Checks()
        checks.oneOf("status", status, STATUSES, required = false)
        checks.done()
        return imports.page(person.requireTenant(), status, after, limit + 1)
    }

    private fun replay(existing: ImportRow, sha: String, dryRun: Boolean, reviewedImportId: UUID?): ImportRow {
        if (existing.contentSha256 != sha || existing.dryRun != dryRun || existing.reviewedImportId != reviewedImportId) {
            throw idempotencyConflict()
        }
        return existing
    }

    private fun checkReview(tenantId: UUID, reviewedImportId: UUID, sha: String, dryRun: Boolean) {
        if (dryRun) throw Problems.validation("reviewedImportId", "requires_apply", "Aplicar una revisión exige dryRun=false.")
        val reviewed = imports.find(tenantId, reviewedImportId)
            ?: throw Problems.validation("reviewedImportId", "import_not_found", "Esa revisión no existe.")
        if (!reviewed.dryRun || reviewed.status != "ready") {
            throw Problems.conflict("review_not_applicable", "Sólo se aplica una revisión que quedó lista sin aplicar.")
        }
        if (reviewed.appliedByImportId != null) throw reviewAlreadyApplied()
        if (reviewed.contentSha256 != sha) {
            throw Problems.conflict("review_mismatch", "El archivo no es el que se revisó: su huella es distinta. Revísalo de nuevo.")
        }
    }

    private fun reviewAlreadyApplied() = Problems.conflict("review_already_applied", "Esa revisión ya se aplicó.")

    private fun idempotencyConflict() = Problems.conflict("idempotency_conflict", "La clave de idempotencia ya se usó con otro contenido.")

    /** Sólo el nombre, sin ruta ni caracteres de control, y a lo más 255 caracteres. */
    private fun cleanFileName(raw: String?): String? =
        raw?.substringAfterLast('/')?.substringAfterLast('\\')?.filterNot { it.isISOControl() }?.trim()?.take(MAX_FILE_NAME)?.ifEmpty { null }

    private enum class Change { CREATED, UPDATED, UNCHANGED }

    private fun change(row: AcceptedRow, existing: EmployeeRow?): Change = when {
        existing == null -> Change.CREATED
        existing.displayName != row.displayName || existing.siteId != row.siteId || existing.employmentStart != row.employmentStart -> Change.UPDATED
        else -> Change.UNCHANGED
    }

    /** Alta o actualización por identificador externo: repetir el archivo no duplica a nadie. */
    private fun apply(tenantId: UUID, plan: List<Pair<AcceptedRow, EmployeeRow?>>) {
        for ((row, existing) in plan) {
            if (existing == null) {
                try {
                    employees.insert(tenantId, UUID.randomUUID(), row.externalId, row.displayName, row.siteId, row.employmentStart, "csv")
                } catch (e: RuntimeException) {
                    // Alguien dio de alta a esa persona mientras corría la importación.
                    throw if (Conflicts.uniqueConstraint(e) == Conflicts.EMPLOYEE_EXTERNAL_ID) Conflicts.externalIdTaken() else e
                }
            } else if (change(row, existing) == Change.UPDATED) {
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
        const val MAX_FILE_NAME = 255
        val STATUSES = setOf("ready", "applied", "failed")

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
        @RequestParam("reviewedImportId", required = false) reviewedImportId: String?,
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
        val reviewed = reviewedImportId?.takeIf { it.isNotBlank() }?.let {
            runCatching { UUID.fromString(it) }.getOrNull()
                ?: throw Problems.validation("reviewedImportId", "invalid_identifier", "Debe ser un UUID.")
        }
        return ImportView.of(service.run(person, key, file.bytes, dry, file.originalFilename, reviewed))
    }

    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam status: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<ImportView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, status, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.createdAt, it.id) }) { ImportView.of(it) }
    }

    @GetMapping("/{importId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable importId: UUID): ImportView =
        ImportView.of(service.get(person, importId))
}
