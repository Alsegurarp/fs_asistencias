package mx.fastsolution.zenit.audit

import mx.fastsolution.zenit.api.Correlation
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.identity.CurrentPerson
import org.jooq.DSLContext
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime
import java.util.UUID

data class AuditRow(
    val id: UUID,
    val at: OffsetDateTime,
    val actorType: String,
    val actorId: String?,
    val action: String,
    val targetType: String,
    val targetId: String?,
    val correlationId: UUID,
    /** JSON tal como lo guarda la base. */
    val metadata: String,
)

/**
 * Bitácora de acciones administrativas. Sólo se agrega: el rol de la base con
 * el que atiende el backend no puede corregirla ni borrarla.
 */
@Repository
class AuditLog(private val dsl: DSLContext) {
    fun record(
        tenantId: UUID?,
        actor: CurrentPerson,
        action: String,
        targetType: String,
        targetId: UUID?,
        metadata: Map<String, String> = emptyMap(),
    ) {
        dsl.execute(
            "insert into audit_log (id, tenant_id, actor_type, actor_id, action, target_type, target_id, correlation_id, metadata) " +
                "values (?, cast(? as uuid), 'user', ?, ?, ?, cast(? as text), ?, cast(? as jsonb))",
            UUID.randomUUID(),
            tenantId,
            actor.actorId,
            action,
            targetType,
            targetId?.toString(),
            Correlation.current(),
            json(metadata),
        )
    }

    /** Lo más reciente primero, y sólo de la empresa indicada. */
    fun page(tenantId: UUID, action: String?, from: OffsetDateTime?, to: OffsetDateTime?, after: PageKey?, limit: Int): List<AuditRow> {
        val sql = StringBuilder(
            "select id, at, actor_type, actor_id, action, target_type, target_id, correlation_id, " +
                "cast(metadata as text) as metadata from audit_log where tenant_id = ?",
        )
        val binds = mutableListOf<Any>(tenantId)
        if (action != null) {
            sql.append(" and action = ?")
            binds += action
        }
        if (from != null) {
            sql.append(" and at >= cast(? as timestamptz)")
            binds += from
        }
        if (to != null) {
            sql.append(" and at < cast(? as timestamptz)")
            binds += to
        }
        if (after != null) {
            sql.append(" and (at, id) < (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by at desc, id desc limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { r ->
            AuditRow(
                id = r.get("id", UUID::class.java),
                at = r.get("at", OffsetDateTime::class.java),
                actorType = r.get("actor_type", String::class.java),
                actorId = r.get("actor_id", String::class.java),
                action = r.get("action", String::class.java),
                targetType = r.get("target_type", String::class.java),
                targetId = r.get("target_id", String::class.java),
                correlationId = r.get("correlation_id", UUID::class.java),
                metadata = r.get("metadata", String::class.java),
            )
        }
    }

    companion object {
        /** Objeto JSON de texto a texto. Los valores nunca llevan secretos ni cuerpos completos. */
        fun json(values: Map<String, String>): String =
            values.entries.joinToString(",", "{", "}") { "${quote(it.key)}:${quote(it.value)}" }

        /** Texto como cadena JSON, con sus escapes. */
        fun quote(text: String): String = buildString {
            append('"')
            for (c in text) {
                when {
                    c == '"' -> append("\\\"")
                    c == '\\' -> append("\\\\")
                    c < ' ' -> append("\\u%04x".format(c.code))
                    else -> append(c)
                }
            }
            append('"')
        }
    }
}
