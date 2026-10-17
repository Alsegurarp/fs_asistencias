package mx.fastsolution.zenit.integration

import mx.fastsolution.zenit.identity.CurrentPerson
import org.jooq.DSLContext
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime
import java.util.UUID

data class CheckpointView(
    val sourceId: String,
    val type: String,
    val status: String,
    val cursor: String?,
    val sourceVersion: String?,
    val updatedAt: String,
)

data class CheckpointList(val items: List<CheckpointView>)

/**
 * De dónde viene el padrón de una empresa y hasta dónde se sincronizó. Hoy la
 * única fuente que existe es el archivo CSV; el conector llegará con su corte.
 */
@Repository
class SourceRepository(private val dsl: DSLContext) {
    /**
     * Deja constancia de una carga aplicada: crea la fuente CSV de la empresa
     * si no existía y mueve su punto de sincronización a esa carga.
     */
    fun recordCsv(tenantId: UUID, importId: UUID, templateVersion: Int) {
        dsl.execute(
            "insert into integration_source (tenant_id, id, type, status) values (?, ?, 'csv', 'active') " +
                "on conflict (tenant_id, type) do nothing",
            tenantId, UUID.randomUUID(),
        )
        dsl.execute(
            "insert into integration_checkpoint (tenant_id, source_id, sync_cursor, source_version, updated_at) " +
                "select tenant_id, id, ?, ?, now() from integration_source where tenant_id = ? and type = 'csv' " +
                "on conflict (tenant_id, source_id) do update set sync_cursor = excluded.sync_cursor, " +
                "source_version = excluded.source_version, updated_at = excluded.updated_at",
            importId.toString(), templateVersion.toString(), tenantId,
        )
    }

    fun list(tenantId: UUID): List<CheckpointView> =
        dsl.fetch(
            "select s.id, s.type, s.status, c.sync_cursor, c.source_version, coalesce(c.updated_at, s.created_at) as updated_at " +
                "from integration_source s left join integration_checkpoint c on c.tenant_id = s.tenant_id and c.source_id = s.id " +
                "where s.tenant_id = ? order by s.created_at, s.id",
            tenantId,
        ).map {
            CheckpointView(
                sourceId = it.get("id", UUID::class.java).toString(),
                type = it.get("type", String::class.java),
                status = it.get("status", String::class.java),
                cursor = it.get("sync_cursor", String::class.java),
                sourceVersion = it.get("source_version", String::class.java),
                updatedAt = it.get("updated_at", OffsetDateTime::class.java).toInstant().toString(),
            )
        }
}

@RestController
@RequestMapping("/api/v1/integrations")
class SourceController(private val sources: SourceRepository) {
    @GetMapping("/checkpoints")
    fun checkpoints(@AuthenticationPrincipal person: CurrentPerson): CheckpointList = CheckpointList(sources.list(person.requireTenant()))
}
