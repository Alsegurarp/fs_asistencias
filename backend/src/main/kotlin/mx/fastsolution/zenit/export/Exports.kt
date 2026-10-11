package mx.fastsolution.zenit.export

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.jobs.JobHandler
import mx.fastsolution.zenit.jobs.JobProperties
import mx.fastsolution.zenit.jobs.JobRepository
import mx.fastsolution.zenit.jobs.JobRow
import mx.fastsolution.zenit.site.SiteRepository
import mx.fastsolution.zenit.tenant.TenantRepository
import mx.fastsolution.zenit.workday.RuleRepository
import mx.fastsolution.zenit.workday.WeekCalculator
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.json.JsonMapper
import java.security.MessageDigest
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@ConfigurationProperties("zenit.exports")
data class ExportProperties(
    /** Tiempo durante el que un exporte listo se puede descargar. Después el archivo se descarta. */
    val ttlMinutes: Long = 15,
)

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ExportProperties::class)
class ExportConfig

/** Un cierre vigente, con lo que el archivo dice de él. */
data class ClosedRow(
    val closureId: UUID,
    val employeeId: UUID,
    val version: Int,
    val workedMinutes: Int,
    val breakMinutes: Int,
    val ordinaryMinutes: Int,
    val overtimeMinutes: Int,
    val hash: String,
    val closedAt: OffsetDateTime,
    val ruleSetVersion: Int,
    val jurisdiction: String,
    val externalId: String,
    val displayName: String,
    val siteName: String?,
    val acknowledgement: String?,
)

/** Plantilla 1 del archivo: una fila por cierre vigente. */
object ExportCsv {
    const val TEMPLATE_VERSION = 1
    val HEADER = listOf(
        "tenant_slug", "week_start", "time_zone", "rule_set_jurisdiction", "rule_set_version", "external_id", "display_name",
        "site_name", "closure_version", "worked_minutes", "break_minutes", "ordinary_minutes", "overtime_minutes",
        "acknowledgement", "closed_at", "closure_hash",
    )

    // Con esta marca una hoja de cálculo lee bien los acentos.
    private val BOM = byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte())

    // Una hoja de cálculo toma por fórmula la celda que empieza así.
    private const val FORMULA_START = "=+-@\t\r\n＝＋－＠"

    fun render(slug: String, weekStart: LocalDate, timeZone: String, rows: List<ClosedRow>): ByteArray {
        val out = StringBuilder(HEADER.joinToString(",")).append("\r\n")
        for (row in rows) {
            val cells = listOf(
                text(slug), weekStart.toString(), text(timeZone), text(row.jurisdiction), row.ruleSetVersion, text(row.externalId),
                text(row.displayName), text(row.siteName ?: ""), row.version, row.workedMinutes, row.breakMinutes, row.ordinaryMinutes,
                row.overtimeMinutes, row.acknowledgement ?: "", row.closedAt.toInstant().toString(), row.hash,
            )
            out.append(cells.joinToString(",")).append("\r\n")
        }
        return BOM + out.toString().toByteArray(Charsets.UTF_8)
    }

    /**
     * Texto de una celda: entre comillas y con las comillas dobladas. Si empieza
     * con algo que una hoja de cálculo ejecutaría, se le antepone un apóstrofo.
     */
    fun text(value: String): String {
        val safe = if (value.isNotEmpty() && value[0] in FORMULA_START) "'$value" else value
        return "\"" + safe.replace("\"", "\"\"") + "\""
    }
}

data class ExportRecord(
    val id: UUID,
    val weekStart: LocalDate,
    val siteId: UUID?,
    val format: String,
    val timeZone: String,
    val ruleSetVersion: Int,
    val status: String,
    val rowCount: Int?,
    val manifestHash: String?,
    val fileHash: String?,
    val requestSha256: String,
    val createdAt: OffsetDateTime,
    val expiresAt: OffsetDateTime?,
) {
    /** Listo y vencido es vencido, aunque todavía no pase quien lo marca. */
    fun effectiveStatus(now: OffsetDateTime): String =
        if (status == "ready" && expiresAt != null && expiresAt <= now) "expired" else status
}

data class ExportFile(val record: ExportRecord, val content: ByteArray?)

data class ExportView(
    val id: String,
    val status: String,
    val weekStart: String,
    val siteId: String?,
    val format: String,
    val timeZone: String,
    val ruleSetVersion: Int,
    val rowCount: Int?,
    val manifestHash: String?,
    val fileHash: String?,
    val downloadUrl: String?,
    val expiresAt: String?,
    val createdAt: String,
) {
    companion object {
        fun of(row: ExportRecord): ExportView {
            val status = row.effectiveStatus(OffsetDateTime.now())
            val ready = status == "ready"
            return ExportView(
                id = row.id.toString(),
                status = status,
                weekStart = row.weekStart.toString(),
                siteId = row.siteId?.toString(),
                format = row.format,
                timeZone = row.timeZone,
                ruleSetVersion = row.ruleSetVersion,
                rowCount = row.rowCount,
                manifestHash = row.manifestHash,
                fileHash = row.fileHash,
                // Sólo hay enlace mientras hay algo que descargar.
                downloadUrl = if (ready) "/api/v1/exports/${row.id}/download" else null,
                expiresAt = if (ready) row.expiresAt?.toInstant()?.toString() else null,
                createdAt = row.createdAt.toInstant().toString(),
            )
        }
    }
}

class ExportCreateRequest {
    var weekStart: String? = null
    var siteId: String? = null
    var format: String? = null
}

@Repository
class ExportRepository(private val dsl: DSLContext) {
    fun find(tenantId: UUID, id: UUID): ExportRecord? = dsl.fetchOne("$SELECT where tenant_id = ? and id = ?", tenantId, id)?.let(::row)

    fun findByKey(tenantId: UUID, key: UUID): ExportRecord? =
        dsl.fetchOne("$SELECT where tenant_id = ? and idempotency_key = ?", tenantId, key)?.let(::row)

    /** Aparta el exporte para decidir sobre él, con su archivo. */
    fun lock(tenantId: UUID, id: UUID): ExportFile? =
        dsl.fetchOne("select $COLUMNS, content from export where tenant_id = ? and id = ? for update", tenantId, id)
            ?.let { ExportFile(row(it), it.get("content", ByteArray::class.java)) }

    fun insert(
        tenantId: UUID,
        id: UUID,
        key: UUID,
        requestSha256: String,
        weekStart: LocalDate,
        siteId: UUID?,
        format: String,
        timeZone: String,
        ruleSetId: UUID,
        ruleSetVersion: Int,
        requestedBy: UUID,
    ) {
        dsl.execute(
            "insert into export (tenant_id, id, idempotency_key, request_sha256, week_start, site_id, format, template_version, time_zone, " +
                "rule_set_id, rule_set_version, status, requested_by) values (?, ?, ?, ?, cast(? as date), cast(? as uuid), ?, ?, ?, ?, ?, 'queued', ?)",
            tenantId, id, key, requestSha256, weekStart.toString(), siteId, format, ExportCsv.TEMPLATE_VERSION, timeZone, ruleSetId,
            ruleSetVersion, requestedBy,
        )
    }

    fun countClosed(tenantId: UUID, weekStart: LocalDate, siteId: UUID?): Int = closedRows(tenantId, weekStart, siteId).size

    /** Los cierres vigentes de esa semana, de toda la empresa o de una sede, en un orden estable. */
    fun closedRows(tenantId: UUID, weekStart: LocalDate, siteId: UUID?): List<ClosedRow> {
        val sql = StringBuilder(
            "select c.id as closure_id, c.employee_id, c.version, c.worked_minutes, c.break_minutes, c.ordinary_minutes, " +
                "c.overtime_minutes, cast(c.hash as text) as hash, c.closed_at, c.rule_set_version, r.jurisdiction, e.external_id, " +
                "e.display_name, s.name as site_name, k.type as ack_type from week_closure c " +
                "join employee e on e.tenant_id = c.tenant_id and e.id = c.employee_id " +
                "join rule_set r on r.id = c.rule_set_id " +
                "left join site s on s.tenant_id = e.tenant_id and s.id = e.site_id " +
                "left join closure_acknowledgement k on k.tenant_id = c.tenant_id and k.closure_id = c.id " +
                "where c.tenant_id = ? and c.week_start = cast(? as date) and c.status = 'closed'",
        )
        val binds = mutableListOf<Any>(tenantId, weekStart.toString())
        if (siteId != null) {
            sql.append(" and e.site_id = ?")
            binds += siteId
        }
        sql.append(" order by e.external_id, c.id")
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { r ->
            ClosedRow(
                closureId = r.get("closure_id", UUID::class.java),
                employeeId = r.get("employee_id", UUID::class.java),
                version = r.get("version", Number::class.java).toInt(),
                workedMinutes = r.get("worked_minutes", Number::class.java).toInt(),
                breakMinutes = r.get("break_minutes", Number::class.java).toInt(),
                ordinaryMinutes = r.get("ordinary_minutes", Number::class.java).toInt(),
                overtimeMinutes = r.get("overtime_minutes", Number::class.java).toInt(),
                hash = r.get("hash", String::class.java).trim(),
                closedAt = r.get("closed_at", OffsetDateTime::class.java),
                ruleSetVersion = r.get("rule_set_version", Number::class.java).toInt(),
                jurisdiction = r.get("jurisdiction", String::class.java),
                externalId = r.get("external_id", String::class.java),
                displayName = r.get("display_name", String::class.java),
                siteName = r.get("site_name", String::class.java),
                acknowledgement = r.get("ack_type", String::class.java),
            )
        }
    }

    fun ready(tenantId: UUID, id: UUID, rowCount: Int, manifest: String, manifestHash: String, fileHash: String, content: ByteArray, ttlMinutes: Long) {
        dsl.execute(
            "update export set status = 'ready', row_count = ?, manifest = cast(? as json), manifest_hash = ?, file_hash = ?, content = ?, " +
                "ready_at = now(), expires_at = now() + (? * interval '1 minute') where tenant_id = ? and id = ?",
            rowCount, manifest, manifestHash, fileHash, content, ttlMinutes, tenantId, id,
        )
    }

    fun failed(tenantId: UUID, id: UUID, failure: String): Boolean =
        dsl.execute("update export set status = 'failed', failure = ? where tenant_id = ? and id = ? and status = 'queued'", failure, tenantId, id) == 1

    /** El enlace es de un solo uso: descargado, el archivo se descarta. */
    fun consume(tenantId: UUID, id: UUID, by: UUID) {
        dsl.execute(
            "update export set status = 'expired', content = null, downloaded_at = now(), downloaded_by = ? where tenant_id = ? and id = ?",
            by, tenantId, id,
        )
    }

    /** Descarta el archivo de lo que venció sin descargarse. */
    fun expire(): Int = dsl.execute("update export set status = 'expired', content = null where status = 'ready' and expires_at <= now()")

    private fun row(r: Record) = ExportRecord(
        id = r.get("id", UUID::class.java),
        weekStart = LocalDate.parse(r.get("week_start", String::class.java)),
        siteId = r.get("site_id", UUID::class.java),
        format = r.get("format", String::class.java),
        timeZone = r.get("time_zone", String::class.java),
        ruleSetVersion = r.get("rule_set_version", Number::class.java).toInt(),
        status = r.get("status", String::class.java),
        rowCount = r.get("row_count", Number::class.java)?.toInt(),
        manifestHash = r.get("manifest_hash", String::class.java)?.trim(),
        fileHash = r.get("file_hash", String::class.java)?.trim(),
        requestSha256 = r.get("request_sha256", String::class.java).trim(),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        expiresAt = r.get("expires_at", OffsetDateTime::class.java),
    )

    private companion object {
        const val COLUMNS =
            "id, cast(week_start as text) as week_start, site_id, format, time_zone, rule_set_version, status, row_count, " +
                "cast(manifest_hash as text) as manifest_hash, cast(file_hash as text) as file_hash, " +
                "cast(request_sha256 as text) as request_sha256, created_at, expires_at"
        const val SELECT = "select $COLUMNS from export"
    }
}

internal fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

/**
 * Exporte de los cierres vigentes de una semana. Pedirlo sólo lo encola: lo
 * prepara un trabajo. El archivo se descarga una vez, con credencial, y deja
 * de conservarse; quedan su manifiesto y sus huellas.
 */
@Service
class ExportService(
    private val exports: ExportRepository,
    private val jobs: JobRepository,
    private val jobProperties: JobProperties,
    private val tenants: TenantRepository,
    private val sites: SiteRepository,
    private val rules: RuleRepository,
    private val audit: AuditLog,
) {
    @Transactional
    fun request(person: CurrentPerson, key: UUID, request: ExportCreateRequest): ExportRecord {
        val tenantId = person.requireTenant()
        val requestedBy = person.userId ?: throw Problems.forbidden()
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        val checks = Checks()
        val date = checks.date("weekStart", request.weekStart, required = true)
        val siteId = checks.uuid("siteId", request.siteId, required = false)
        val format = checks.oneOf("format", request.format, FORMATS, required = true)
        if (siteId != null && sites.find(tenantId, siteId) == null) checks.fail("siteId", "site_not_found", "La sede no existe.")
        checks.done()

        val weekStart = WeekCalculator.weekStart(date!!, tenant.weekStartsOn)
        val requestSha = sha256("$weekStart|${siteId ?: ""}|$format".toByteArray())
        // La misma clave nunca crea dos exportes.
        exports.findByKey(tenantId, key)?.let {
            if (it.requestSha256 != requestSha) throw idempotencyConflict()
            return it
        }
        val ruleSet = rules.effectiveOn(weekStart.plusDays(6))
            ?: throw Problems.validation("weekStart", "no_rules_for_date", "No hay reglas laborales registradas para esa semana.")
        if (exports.countClosed(tenantId, weekStart, siteId) == 0) {
            throw Problems.validation("weekStart", "no_closed_weeks", "Esa semana no tiene cierres vigentes que exportar.")
        }

        val id = UUID.randomUUID()
        try {
            exports.insert(tenantId, id, key, requestSha, weekStart, siteId, format!!, tenant.timeZone, ruleSet.id, ruleSet.version, requestedBy)
        } catch (e: RuntimeException) {
            // Otra petición con la misma clave ganó; el cliente reintenta y recibe su exporte.
            throw if (Conflicts.uniqueConstraint(e) == Conflicts.EXPORT_IDEMPOTENCY) idempotencyConflict() else e
        }
        jobs.enqueue(tenantId, ExportJob.TYPE, id, jobProperties.maxAttempts)
        audit.record(tenantId, person, "export.requested", "export", id, mapOf("weekStart" to weekStart.toString(), "format" to format))
        return exports.find(tenantId, id)!!
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): ExportRecord = exports.find(person.requireTenant(), id) ?: throw Problems.notFound()

    /** Entrega el archivo una sola vez y deja constancia de quién lo descargó. */
    @Transactional
    fun download(person: CurrentPerson, id: UUID): Pair<String, ByteArray> {
        val tenantId = person.requireTenant()
        val by = person.userId ?: throw Problems.forbidden()
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        val file = exports.lock(tenantId, id) ?: throw Problems.notFound()
        val content = file.content
        when (file.record.effectiveStatus(OffsetDateTime.now())) {
            "queued" -> throw Problems.conflict("export_not_ready", "El exporte todavía se está preparando.")
            "failed" -> throw Problems.gone("export_failed", "El exporte no se pudo preparar; hay que pedirlo otra vez.")
            "ready" -> if (content == null) throw gone()
            else -> throw gone()
        }
        exports.consume(tenantId, id, by)
        audit.record(tenantId, person, "export.downloaded", "export", id, mapOf("fileHash" to (file.record.fileHash ?: "")))
        return "zenit-${tenant.slug}-${file.record.weekStart}.${file.record.format}" to content!!
    }

    private fun gone() = Problems.gone("export_expired", "El enlace ya se usó o venció; hay que pedir el exporte otra vez.")

    private fun idempotencyConflict() = Problems.conflict("idempotency_conflict", "La clave de idempotencia ya se usó con otro contenido.")

    private companion object {
        val FORMATS = setOf("csv")
    }
}

/** Lo que el manifiesto dice de cada cierre que entró al archivo. */
data class ManifestClosure(val closureId: String, val employeeId: String, val version: Int, val ruleSetVersion: Int, val hash: String)

data class ManifestTenant(val id: String, val slug: String, val name: String)

/** Declara qué se exportó y de dónde salió: liga el archivo con los cierres por sus huellas. */
data class ExportManifest(
    val exportId: String,
    val templateVersion: Int,
    val format: String,
    val tenant: ManifestTenant,
    val weekStart: String,
    val timeZone: String,
    val siteId: String?,
    val rowCount: Int,
    val fileSha256: String,
    val closures: List<ManifestClosure>,
    val generatedAt: String,
)

/** Prepara el archivo de un exporte encolado. */
@Component
class ExportJob(
    private val exports: ExportRepository,
    private val tenants: TenantRepository,
    private val properties: ExportProperties,
    private val audit: AuditLog,
    private val json: JsonMapper,
) : JobHandler {
    override val type = TYPE

    @Transactional
    override fun handle(job: JobRow) {
        val tenantId = job.tenantId ?: return
        val export = exports.lock(tenantId, job.referenceId)?.record ?: return
        // Repetir el trabajo no vuelve a preparar lo que ya se preparó.
        if (export.status != "queued") return
        val tenant = tenants.find(tenantId) ?: return
        val rows = exports.closedRows(tenantId, export.weekStart, export.siteId)
        if (rows.isEmpty()) {
            // Entre pedirlo y prepararlo se reabrieron los cierres: no hay nada que exportar.
            fail(tenantId, export.id, "no_closed_weeks")
            return
        }
        val content = ExportCsv.render(tenant.slug, export.weekStart, export.timeZone, rows)
        val fileHash = sha256(content)
        val manifest = json.writeValueAsString(
            ExportManifest(
                exportId = export.id.toString(),
                templateVersion = ExportCsv.TEMPLATE_VERSION,
                format = export.format,
                tenant = ManifestTenant(tenant.id.toString(), tenant.slug, tenant.name),
                weekStart = export.weekStart.toString(),
                timeZone = export.timeZone,
                siteId = export.siteId?.toString(),
                rowCount = rows.size,
                fileSha256 = fileHash,
                closures = rows.map { ManifestClosure(it.closureId.toString(), it.employeeId.toString(), it.version, it.ruleSetVersion, it.hash) },
                generatedAt = OffsetDateTime.now().toInstant().toString(),
            ),
        )
        val manifestHash = sha256(manifest.toByteArray())
        exports.ready(tenantId, export.id, rows.size, manifest, manifestHash, fileHash, content, properties.ttlMinutes)
        audit.record(tenantId, "system", null, "export.ready", "export", export.id, mapOf("rows" to rows.size.toString(), "fileHash" to fileHash))
    }

    @Transactional
    override fun abandoned(job: JobRow, error: String) {
        val tenantId = job.tenantId ?: return
        fail(tenantId, job.referenceId, "job_abandoned")
    }

    /** Lo que venció sin descargarse deja de conservar su archivo. */
    @Transactional
    override fun maintain() {
        exports.expire()
    }

    private fun fail(tenantId: UUID, id: UUID, failure: String) {
        if (exports.failed(tenantId, id, failure)) {
            audit.record(tenantId, "system", null, "export.failed", "export", id, mapOf("failure" to failure))
        }
    }

    companion object {
        const val TYPE = "export"
    }
}

@RestController
@RequestMapping("/api/v1/exports")
class ExportController(private val service: ExportService) {
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun create(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody request: ExportCreateRequest,
    ): ExportView {
        val key = try {
            UUID.fromString(idempotencyKey ?: "")
        } catch (e: IllegalArgumentException) {
            throw Problems.validation("Idempotency-Key", "invalid_identifier", "La cabecera Idempotency-Key debe ser un UUID.")
        }
        return ExportView.of(service.request(person, key, request))
    }

    @GetMapping("/{exportId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable exportId: UUID): ExportView =
        ExportView.of(service.get(person, exportId))

    @GetMapping("/{exportId}/download")
    fun download(@AuthenticationPrincipal person: CurrentPerson, @PathVariable exportId: UUID): ResponseEntity<ByteArray> {
        val (name, content) = service.download(person, exportId)
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$name\"")
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(content)
    }
}
