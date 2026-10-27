package mx.fastsolution.zenit.dossier

import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.jobs.JobHandler
import mx.fastsolution.zenit.jobs.JobRow
import org.jooq.DSLContext
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Isolation
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.time.OffsetDateTime
import java.util.UUID

@Component
class DossierJob(private val dsl: DSLContext, private val dossiers: DossierRepository, private val audit: AuditLog, private val json: JsonMapper, private val files: DossierDownloadFiles) : JobHandler {
    override val type = TYPE

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    override fun handle(job: JobRow) {
        val tenantId = job.tenantId ?: return
        val dossier = dossiers.find(tenantId, job.referenceId, lock = true) ?: return
        if (dossier.view.status == "expired") { expire(tenantId, job.referenceId); return }
        if (dossier.view.status !in setOf("queued", "preparing")) return
        val tenant = dsl.fetchOne(
            "select t.time_zone from tenant t join tenant_user u on u.tenant_id = t.id " +
                "join dossier_permission p on p.tenant_id = u.tenant_id and p.user_id = u.id " +
                "where t.id = ? and t.status = 'active' and u.id = ? and u.status = 'active' and u.subject = ? " +
                "and u.linked_at = cast(? as timestamptz) and p.enabled and p.subject = u.subject and p.linked_at = u.linked_at",
            tenantId, dossier.view.requestedBy, dossier.subject, dossier.linkedAt,
        ) ?: run { fail(tenantId, job.referenceId); return }
        val snapshot = dsl.fetchOne("select transaction_timestamp() as at")!!.get("at", OffsetDateTime::class.java)
        dsl.execute("update dossier set status = 'preparing', snapshot_at = cast(? as timestamptz) where tenant_id = ? and id = ?", snapshot, tenantId, job.referenceId)
        dossiers.clearChunks(tenantId, job.referenceId)
        val output = DossierChunkOutput { position, content -> dossiers.addChunk(tenantId, job.referenceId, position, content) }
        val archive = DossierArchive(json).write(
            output, tenantId, job.referenceId, dossier.view.requestedBy, snapshot.toInstant().toString(), tenant.get("time_zone", String::class.java),
        ) { kind, emit ->
            val collection = dossierCollections.first { it.kind == kind }
            val where = when (kind) { "tenant" -> "id = ?"; "rule_set" -> "true"; else -> "tenant_id = ?" }
            // JDBC con cursor real: fetchSize sin transacción cargaría toda la consulta en memoria.
            dsl.connection { connection ->
                check(!connection.autoCommit)
                connection.prepareStatement("select row_to_json(r)::text from (select ${collection.columns} from $kind where $where order by ${collection.order}) r").use { statement ->
                    statement.fetchSize = 256
                    if (kind != "rule_set") statement.setObject(1, tenantId)
                    statement.executeQuery().use { rows -> while (rows.next()) emit(rows.getString(1)) }
                }
            }
        }
        val published = dsl.execute(
            "update dossier set status = 'ready', ready_at = clock_timestamp(), manifest = ?, manifest_sha256 = ?, file_sha256 = ? " +
                "where tenant_id = ? and id = ? and expires_at > clock_timestamp()",
            archive.manifest, archive.manifestSha256, archive.fileSha256, tenantId, job.referenceId,
        )
        if (published == 0) { expire(tenantId, job.referenceId); return }
        audit.record(tenantId, "system", null, "dossier.ready", "dossier", job.referenceId, mapOf("fileHash" to archive.fileSha256))
    }

    @Transactional
    override fun abandoned(job: JobRow, error: String) { job.tenantId?.let { fail(it, job.referenceId) } }

    @Transactional
    override fun maintain() {
        val expired = dsl.fetch(
            "update dossier set status = 'expired' where status in ('queued', 'preparing', 'ready') and expires_at <= clock_timestamp() returning tenant_id, id",
        )
        expired.forEach { r -> audit.record(r.get("tenant_id", UUID::class.java), "system", null, "dossier.expired", "dossier", r.get("id", UUID::class.java)) }
        dsl.execute("delete from dossier_chunk c using dossier d where d.tenant_id = c.tenant_id and d.id = c.dossier_id and d.status in ('expired', 'downloaded', 'failed')")
        files.maintain()
    }

    private fun expire(tenantId: UUID, id: UUID) {
        if (dsl.execute("update dossier set status = 'expired' where tenant_id = ? and id = ? and status in ('queued', 'preparing', 'ready')", tenantId, id) > 0) {
            dossiers.clearChunks(tenantId, id)
            audit.record(tenantId, "system", null, "dossier.expired", "dossier", id)
        }
    }

    private fun fail(tenantId: UUID, id: UUID) {
        if (dsl.execute("update dossier set status = 'failed', failure_code = 'preparation_failed' where tenant_id = ? and id = ? and status in ('queued', 'preparing')", tenantId, id) > 0) {
            dossiers.clearChunks(tenantId, id)
            audit.record(tenantId, "system", null, "dossier.failed", "dossier", id)
        }
    }

    companion object { const val TYPE = "dossier" }
}
