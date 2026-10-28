package mx.fastsolution.zenit.dossier

import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.export.sha256
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.jobs.JobProperties
import mx.fastsolution.zenit.jobs.JobRepository
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import tools.jackson.databind.JsonNode
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.UUID

class DossierCreateRequest { var formatVersion: JsonNode? = null }

data class DossierView(
    val id: UUID, val tenantId: UUID, val requestedBy: UUID, val formatVersion: Int,
    val scope: String = "all_retained", val status: String, val createdAt: String, val expiresAt: String,
    val snapshotAt: String?, val readyAt: String?, val manifestSha256: String?, val fileSha256: String?, val failureCode: String?,
)

data class DossierRow(val view: DossierView, val subject: String, val linkedAt: OffsetDateTime, val requestSha256: String)

internal fun ownedDossier(account: DossierAccount, row: DossierRow): DossierRow {
    if (row.view.requestedBy != account.userId || row.subject != account.subject || row.linkedAt.toInstant() != account.linkedAt.toInstant()) throw Problems.notFound()
    return row
}

@Repository
class DossierRepository(private val dsl: DSLContext) {
    fun find(tenantId: UUID, id: UUID, lock: Boolean = false): DossierRow? =
        dsl.fetchOne("select $COLUMNS from dossier where tenant_id = ? and id = ?${if (lock) " for update" else ""}", tenantId, id)?.let(::row)

    fun byKey(account: DossierAccount, key: UUID): DossierRow? = dsl.fetchOne(
        "select $COLUMNS from dossier where tenant_id = ? and requested_by = ? and idempotency_key = ?", account.tenantId, account.userId, key,
    )?.let(::row)

    fun insert(account: DossierAccount, key: UUID, requestHash: String): Boolean = dsl.execute(
        "insert into dossier (tenant_id, id, requested_by, requested_subject, requested_linked_at, idempotency_key, request_sha256, format_version, status) " +
            "values (?, ?, ?, ?, cast(? as timestamptz), ?, ?, 1, 'queued') on conflict (tenant_id, requested_by, idempotency_key) do nothing",
        account.tenantId, UUID.randomUUID(), account.userId, account.subject, account.linkedAt, key, requestHash,
    ) == 1

    fun manifest(tenantId: UUID, id: UUID): String? =
        dsl.fetchOne("select manifest from dossier where tenant_id = ? and id = ?", tenantId, id)?.get("manifest", String::class.java)

    fun addChunk(tenantId: UUID, id: UUID, position: Int, bytes: ByteArray) {
        dsl.execute("insert into dossier_chunk (tenant_id, dossier_id, position, content) values (?, ?, ?, ?)", tenantId, id, position, bytes)
    }

    fun clearChunks(tenantId: UUID, id: UUID) {
        dsl.execute("delete from dossier_chunk where tenant_id = ? and dossier_id = ?", tenantId, id)
    }

    private fun row(r: Record): DossierRow {
        fun instant(name: String) = r.get(name, OffsetDateTime::class.java)?.toInstant()?.toString()
        val expired = r.get("expired", Boolean::class.java) && r.get("status", String::class.java) in setOf("queued", "preparing", "ready")
        return DossierRow(
            DossierView(
                id = r.get("id", UUID::class.java), tenantId = r.get("tenant_id", UUID::class.java), requestedBy = r.get("requested_by", UUID::class.java),
                formatVersion = r.get("format_version", Int::class.java), status = if (expired) "expired" else r.get("status", String::class.java),
                createdAt = instant("created_at")!!, expiresAt = instant("expires_at")!!, snapshotAt = instant("snapshot_at"), readyAt = instant("ready_at"),
                manifestSha256 = r.get("manifest_sha256", String::class.java)?.trim(), fileSha256 = r.get("file_sha256", String::class.java)?.trim(),
                failureCode = r.get("failure_code", String::class.java),
            ), r.get("requested_subject", String::class.java), r.get("requested_linked_at", OffsetDateTime::class.java), r.get("request_sha256", String::class.java).trim(),
        )
    }

    private companion object {
        const val COLUMNS = "tenant_id, id, requested_by, requested_subject, requested_linked_at, request_sha256, format_version, status, " +
            "created_at, expires_at, snapshot_at, ready_at, manifest_sha256, file_sha256, failure_code, expires_at <= clock_timestamp() as expired"
    }
}

@Service
class DossierService(
    private val access: DossierAccess, private val dossiers: DossierRepository, private val jobs: JobRepository,
    private val properties: JobProperties, private val audit: AuditLog,
) {
    @Transactional
    fun request(person: CurrentPerson, key: String?, request: DossierCreateRequest): DossierView {
        val account = access.require(person)
        val idempotencyKey = try {
            UUID.fromString(key ?: "").also { if (!it.toString().equals(key, ignoreCase = true)) throw IllegalArgumentException() }
        } catch (_: IllegalArgumentException) {
            throw Problems.validation("Idempotency-Key", "invalid_identifier", "Idempotency-Key debe ser un UUID.")
        }
        val version = request.formatVersion
        if (version?.isNumber != true || version.asString().toBigDecimalOrNull()?.compareTo(BigDecimal.ONE) != 0) {
            throw Problems.validation("formatVersion", "invalid_value", "El formato admitido es el número 1.")
        }
        val requestHash = sha256("{\"formatVersion\":1}".toByteArray())
        val inserted = dossiers.insert(account, idempotencyKey, requestHash)
        val row = dossiers.byKey(account, idempotencyKey)!!
        ownedDossier(account, row)
        if (row.requestSha256 != requestHash) throw Problems.conflict("idempotency_conflict", "La clave ya se usó con otro contenido.")
        if (inserted) {
            jobs.enqueue(account.tenantId, DossierJob.TYPE, row.view.id, properties.maxAttempts)
            audit.record(account.tenantId, person, "dossier.requested", "dossier", row.view.id)
        }
        return row.view
    }

    @Transactional
    fun get(person: CurrentPerson, id: UUID): DossierView = owned(person, id).view

    @Transactional
    fun manifest(person: CurrentPerson, id: UUID): ByteArray {
        val row = owned(person, id)
        return dossiers.manifest(row.view.tenantId, id)?.toByteArray(Charsets.UTF_8)
            ?: throw Problems.conflict("dossier_not_ready", "El expediente todavía no tiene un manifiesto.")
    }

    private fun owned(person: CurrentPerson, id: UUID): DossierRow {
        val account = access.require(person)
        return ownedDossier(account, dossiers.find(account.tenantId, id) ?: throw Problems.notFound())
    }
}

@RestController
@RequestMapping("/api/v1")
class DossierController(private val access: DossierAccess, private val service: DossierService) {
    @GetMapping("/me/dossier-permission")
    fun permission(@AuthenticationPrincipal person: CurrentPerson): ResponseEntity<DossierPermission> = response(access.own(person))

    @PutMapping("/users/{userId}/dossier-permission")
    fun setPermission(@AuthenticationPrincipal person: CurrentPerson, @PathVariable userId: UUID, @RequestBody request: DossierPermissionRequest): ResponseEntity<DossierPermission> =
        response(access.set(person, userId, request))

    @PostMapping("/dossiers")
    fun create(@AuthenticationPrincipal person: CurrentPerson, @RequestHeader("Idempotency-Key", required = false) key: String?, @RequestBody request: DossierCreateRequest): ResponseEntity<DossierView> =
        response(service.request(person, key, request), HttpStatus.ACCEPTED)

    @GetMapping("/dossiers/{dossierId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable dossierId: UUID): ResponseEntity<DossierView> = response(service.get(person, dossierId))

    @GetMapping("/dossiers/{dossierId}/manifest")
    fun manifest(@AuthenticationPrincipal person: CurrentPerson, @PathVariable dossierId: UUID): ResponseEntity<ByteArray> =
        ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).header(HttpHeaders.CACHE_CONTROL, "no-store").body(service.manifest(person, dossierId))

    private fun <T : Any> response(body: T, status: HttpStatus = HttpStatus.OK): ResponseEntity<T> =
        ResponseEntity.status(status).header(HttpHeaders.CACHE_CONTROL, "no-store").body(body)
}
