package mx.fastsolution.zenit.user

import mx.fastsolution.zenit.api.PageKey
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime
import java.util.UUID

data class UserRow(
    val tenantId: UUID,
    val id: UUID,
    val email: String,
    val subject: String?,
    val displayName: String,
    val status: String,
    val createdAt: OffsetDateTime,
    val linkedAt: OffsetDateTime?,
    val roles: Set<String>,
    /** Su fila del padrón, cuando la persona también es trabajadora. */
    val employeeId: UUID?,
)

/**
 * Personas con acceso al portal. Toda consulta por identificador lleva la
 * empresa: una persona de otra empresa no existe para quien pregunta.
 */
@Repository
class UserRepository(private val dsl: DSLContext) {
    fun insertInvited(tenantId: UUID, id: UUID, email: String, displayName: String) {
        dsl.execute(
            "insert into tenant_user (tenant_id, id, email, display_name, status) values (?, ?, ?, ?, 'invited')",
            tenantId, id, email, displayName,
        )
    }

    fun find(tenantId: UUID, id: UUID): UserRow? =
        dsl.fetchOne("$SELECT where u.tenant_id = ? and u.id = ?", tenantId, id)?.let(::row)

    /** La única búsqueda sin empresa: de ella sale la empresa de quien llama. */
    fun findBySubject(subject: String): UserRow? = dsl.fetchOne("$SELECT where u.subject = ?", subject)?.let(::row)

    fun page(tenantId: UUID, after: PageKey?, limit: Int): List<UserRow> {
        val rows = if (after == null) {
            dsl.fetch("$SELECT where u.tenant_id = ? order by u.created_at, u.id limit ?", tenantId, limit)
        } else {
            dsl.fetch(
                "$SELECT where u.tenant_id = ? and (u.created_at, u.id) > (cast(? as timestamptz), cast(? as uuid)) " +
                    "order by u.created_at, u.id limit ?",
                tenantId, after.at, after.id, limit,
            )
        }
        return rows.map { row(it) }
    }

    /**
     * Liga una invitación con la identidad que entra por primera vez. Sólo
     * toca una invitación sin ligar: si otra petición ganó, no cambia nada.
     */
    fun linkInvitation(email: String, subject: String, displayName: String): Boolean =
        dsl.execute(
            "update tenant_user set subject = ?, linked_at = now(), status = 'active', " +
                "display_name = case when display_name = '' then ? else display_name end " +
                "where email = ? and subject is null and status = 'invited'",
            subject, displayName, email,
        ) == 1

    /** Liga a la persona con su fila del padrón, o la suelta con nulo. */
    fun setEmployee(tenantId: UUID, id: UUID, employeeId: UUID?) {
        dsl.execute("update tenant_user set employee_id = cast(? as uuid) where tenant_id = ? and id = ?", employeeId, tenantId, id)
    }

    fun setDisplayName(tenantId: UUID, id: UUID, displayName: String) {
        dsl.execute("update tenant_user set display_name = ? where tenant_id = ? and id = ?", displayName, tenantId, id)
    }

    fun setStatus(tenantId: UUID, id: UUID, status: String) {
        dsl.execute("update tenant_user set status = ? where tenant_id = ? and id = ?", status, tenantId, id)
    }

    fun grant(tenantId: UUID, id: UUID, role: String, grantedBy: String) {
        dsl.execute(
            "insert into tenant_user_role (tenant_id, user_id, role, granted_by) values (?, ?, ?, ?)",
            tenantId, id, role, grantedBy,
        )
    }

    fun revoke(tenantId: UUID, id: UUID, role: String) {
        dsl.execute("delete from tenant_user_role where tenant_id = ? and user_id = ? and role = ?", tenantId, id, role)
    }

    /** Otras personas de la empresa que pueden administrarla. */
    fun otherAdministrators(tenantId: UUID, exceptId: UUID): Int =
        dsl.fetchOne(
            "select count(*) as total from tenant_user u join tenant_user_role r " +
                "on r.tenant_id = u.tenant_id and r.user_id = u.id " +
                "where u.tenant_id = ? and u.id <> ? and r.role = 'admin_empresa' and u.status <> 'disabled'",
            tenantId, exceptId,
        )!!.get("total", Number::class.java).toInt()

    private fun row(r: Record) = UserRow(
        tenantId = r.get("tenant_id", UUID::class.java),
        id = r.get("id", UUID::class.java),
        email = r.get("email", String::class.java),
        subject = r.get("subject", String::class.java),
        displayName = r.get("display_name", String::class.java),
        status = r.get("status", String::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        linkedAt = r.get("linked_at", OffsetDateTime::class.java),
        roles = r.get("roles", String::class.java).split(',').filter { it.isNotEmpty() }.toSet(),
        employeeId = r.get("employee_id", UUID::class.java),
    )

    private companion object {
        const val SELECT =
            "select u.tenant_id, u.id, u.email, u.subject, u.display_name, u.status, u.created_at, u.linked_at, u.employee_id, " +
                "coalesce((select string_agg(r.role, ',' order by r.role) from tenant_user_role r " +
                "where r.tenant_id = u.tenant_id and r.user_id = u.id), '') as roles from tenant_user u"
    }
}
