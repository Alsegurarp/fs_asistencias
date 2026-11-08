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

/** Qué acciones pide la lista. `group` es una de las llaves de `AuditLog.GROUPS`. */
data class AuditFilter(
    val action: String? = null,
    val group: String? = null,
    val actorType: String? = null,
    val actorId: String? = null,
    val targetType: String? = null,
    val targetId: String? = null,
    val from: OffsetDateTime? = null,
    val to: OffsetDateTime? = null,
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
    ) = record(tenantId, "user", actor.actorId, action, targetType, targetId, metadata)

    /** Para lo que no hace una persona: un dispositivo o el propio sistema. */
    fun record(
        tenantId: UUID?,
        actorType: String,
        actorId: String?,
        action: String,
        targetType: String,
        targetId: UUID?,
        metadata: Map<String, String> = emptyMap(),
    ) {
        dsl.execute(
            "insert into audit_log (id, tenant_id, actor_type, actor_id, action, target_type, target_id, correlation_id, metadata) " +
                "values (?, cast(? as uuid), ?, cast(? as text), ?, ?, cast(? as text), ?, cast(? as jsonb))",
            UUID.randomUUID(),
            tenantId,
            actorType,
            actorId,
            action,
            targetType,
            targetId?.toString(),
            Correlation.current(),
            json(metadata),
        )
    }

    /** Lo más reciente primero, y sólo de la empresa indicada. */
    fun page(tenantId: UUID, filter: AuditFilter, after: PageKey?, limit: Int): List<AuditRow> {
        val sql = StringBuilder(
            "select id, at, actor_type, actor_id, action, target_type, target_id, correlation_id, " +
                "cast(metadata as text) as metadata from audit_log where tenant_id = ?",
        )
        val binds = mutableListOf<Any>(tenantId)
        where(filter, sql, binds)
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

    /**
     * Cuántas acciones cumplen los filtros, contando a lo más hasta `cap`: un
     * total exacto de una bitácora que sólo crece costaría más con cada día.
     * Pasado el tope dice que hay más.
     */
    fun count(tenantId: UUID, filter: AuditFilter, cap: Int): Pair<Int, Boolean> {
        val sql = StringBuilder("select count(*) as total from (select 1 from audit_log where tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        where(filter, sql, binds)
        sql.append(" limit ?) as capped")
        binds += cap + 1
        val total = dsl.fetchOne(sql.toString(), *binds.toTypedArray())!!.get("total", Number::class.java).toInt()
        return total.coerceAtMost(cap) to (total > cap)
    }

    private fun where(filter: AuditFilter, sql: StringBuilder, binds: MutableList<Any>) {
        fun equal(column: String, value: Any?) {
            if (value != null) {
                sql.append(" and $column = ?")
                binds += value
            }
        }
        equal("action", filter.action)
        equal("actor_type", filter.actorType)
        equal("actor_id", filter.actorId)
        equal("target_type", filter.targetType)
        equal("target_id", filter.targetId)
        filter.group?.let { sql.append(" and (${GROUPS.getValue(it)})") }
        if (filter.from != null) {
            sql.append(" and at >= cast(? as timestamptz)")
            binds += filter.from
        }
        if (filter.to != null) {
            sql.append(" and at < cast(? as timestamptz)")
            binds += filter.to
        }
    }

    /**
     * Nombre para mostrar de quien actuó y de lo que tocó, por (tipo, id).
     * Se lee en lote: a lo más una consulta por tipo presente en la página.
     * Lo que no tiene nombre (la empresa, un exporte, el sistema) no aparece.
     */
    fun names(tenantId: UUID, rows: List<AuditRow>): Map<Pair<String, String>, String> {
        val wanted = mutableMapOf<String, MutableSet<UUID>>()
        fun want(type: String, id: String?) {
            if (type !in LABELS) return
            val uuid = id?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return
            wanted.getOrPut(type) { mutableSetOf() } += uuid
        }
        rows.forEach {
            want(it.actorType, it.actorId)
            want(it.targetType, it.targetId)
        }
        return buildMap {
            for ((type, ids) in wanted) {
                dsl.fetch(LABELS.getValue(type), tenantId, ids.toTypedArray()).forEach { r ->
                    val name = r.get("name", String::class.java)
                    if (!name.isNullOrBlank()) put(type to r.get("id", UUID::class.java).toString(), name)
                }
            }
        }
    }

    companion object {
        private const val PERMISSION_ACTIONS = "'dossier.permission_granted', 'dossier.permission_revoked'"

        /**
         * Grupos de acciones de la bitácora, por el prefijo de la acción. Una
         * acción nueva entra sola a su grupo por su prefijo; los permisos de
         * expediente son de accesos, no de exportes.
         */
        val GROUPS = linkedMapOf(
            "closures" to "action like 'week.%'",
            "incidents" to "action like 'incident.%'",
            "directory" to "action like 'employee.%' or action like 'schedule.%' or action like 'import.%'",
            "devices" to "action like 'card.%' or action like 'device.%'",
            "access" to "action like 'user.%' or action in ($PERMISSION_ACTIONS)",
            "settings" to "action like 'tenant.%' or action like 'site.%'",
            "exports" to "action like 'export.%' or (action like 'dossier.%' and action not in ($PERMISSION_ACTIONS))",
        )

        /** Cómo se nombra cada tipo; un incidente y un cierre, por la persona a la que pertenecen. */
        private val LABELS = mapOf(
            "user" to "select id, display_name as name from tenant_user where tenant_id = ? and id = any(?)",
            "device" to "select id, coalesce(label, manufacturer || ' ' || model) as name from device where tenant_id = ? and id = any(?)",
            "employee" to "select id, display_name as name from employee where tenant_id = ? and id = any(?)",
            "card" to "select id, label as name from card where tenant_id = ? and id = any(?)",
            "site" to "select id, name from site where tenant_id = ? and id = any(?)",
            "schedule" to "select id, name from schedule where tenant_id = ? and id = any(?)",
            "incident" to "select i.id, e.display_name as name from incident i join employee e on e.tenant_id = i.tenant_id " +
                "and e.id = i.employee_id where i.tenant_id = ? and i.id = any(?)",
            "week_closure" to "select c.id, e.display_name as name from week_closure c join employee e on e.tenant_id = c.tenant_id " +
                "and e.id = c.employee_id where c.tenant_id = ? and c.id = any(?)",
        )

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
