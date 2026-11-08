package mx.fastsolution.zenit.user

import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.TextSearch
import mx.fastsolution.zenit.identity.Role
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
    val siteIds: Set<UUID> = emptySet(),
    /** Permiso de expediente vigente para su cuenta de hoy; falso en la búsqueda por identidad, que no lo lee. */
    val dossierPermission: Boolean = false,
    val dossierPermissionSince: OffsetDateTime? = null,
)

/** `text` es el patrón ya escapado de `TextSearch`. */
data class UserFilter(
    val text: String? = null,
    val role: String? = null,
    val status: String? = null,
    val dossierPermission: Boolean? = null,
)

data class UserSummaryView(
    val total: Int,
    val active: Int,
    val invited: Int,
    val disabled: Int,
    val byRole: Map<String, Int>,
    val supervisorsWithoutSites: Int,
    val dossierPermission: Int,
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
        dsl.fetchOne("$VIEW where u.tenant_id = ? and u.id = ?", tenantId, id)?.let(::viewRow)

    /** Por correo, dentro de una empresa: una persona de otra empresa no existe para quien pregunta. */
    fun findByEmail(tenantId: UUID, email: String): UserRow? =
        dsl.fetchOne("$SELECT where u.tenant_id = ? and u.email = ?", tenantId, email)?.let(::row)

    /** La única búsqueda sin empresa: de ella sale la empresa de quien llama. */
    fun findBySubject(subject: String): UserRow? = dsl.fetchOne("$SELECT where u.subject = ?", subject)?.let(::row)

    fun page(tenantId: UUID, filter: UserFilter, after: PageKey?, limit: Int): List<UserRow> {
        val sql = StringBuilder("$VIEW where u.tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (filter.text != null) {
            sql.append(TextSearch.clause("u.display_name", "u.email"))
            binds.addAll(TextSearch.binds(filter.text, 2))
        }
        if (filter.role != null) {
            sql.append(" and exists (select 1 from tenant_user_role fr where fr.tenant_id = u.tenant_id and fr.user_id = u.id and fr.role = ?)")
            binds += filter.role
        }
        if (filter.status != null) {
            sql.append(" and u.status = ?")
            binds += filter.status
        }
        when (filter.dossierPermission) {
            true -> sql.append(" and $PERMITTED")
            false -> sql.append(" and not $PERMITTED")
            null -> Unit
        }
        if (after != null) {
            sql.append(" and (u.created_at, u.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by u.created_at, u.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { viewRow(it) }
    }

    /** Conteos para rotular estados, roles y avisos, con la misma búsqueda que la lista. */
    fun summary(tenantId: UUID, text: String?): UserSummaryView {
        fun hasRole(role: String) =
            "exists (select 1 from tenant_user_role sr where sr.tenant_id = u.tenant_id and sr.user_id = u.id and sr.role = '$role')"
        val roleCounts = Role.OF_TENANT.sorted().joinToString(", ") { "count(*) filter (where ${hasRole(it)}) as role_$it" }
        val sql = StringBuilder(
            "select count(*) as total, count(*) filter (where u.status = 'active') as active, " +
                "count(*) filter (where u.status = 'invited') as invited, count(*) filter (where u.status = 'disabled') as disabled, " +
                "$roleCounts, count(*) filter (where ${hasRole("supervisor")} and u.status <> 'disabled' and not exists " +
                "(select 1 from tenant_user_site ss where ss.tenant_id = u.tenant_id and ss.user_id = u.id)) as supervisors_without_sites, " +
                "count(*) filter (where $PERMITTED) as permitted $VIEW_FROM where u.tenant_id = ?",
        )
        val binds = mutableListOf<Any>(tenantId)
        if (text != null) {
            sql.append(TextSearch.clause("u.display_name", "u.email"))
            binds.addAll(TextSearch.binds(text, 2))
        }
        val r = dsl.fetchOne(sql.toString(), *binds.toTypedArray())!!
        fun n(column: String) = r.get(column, Number::class.java).toInt()
        return UserSummaryView(
            n("total"), n("active"), n("invited"), n("disabled"), Role.OF_TENANT.sorted().associateWith { n("role_$it") },
            n("supervisors_without_sites"), n("permitted"),
        )
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

    /**
     * Suelta la liga con la identidad. Quien estaba activa vuelve a quedar
     * invitada; quien estaba deshabilitada sigue así. Falso si no estaba ligada.
     */
    fun unlink(tenantId: UUID, id: UUID): Boolean =
        dsl.execute(
            "update tenant_user set subject = null, linked_at = null, " +
                "status = case when status = 'active' then 'invited' else status end " +
                "where tenant_id = ? and id = ? and subject is not null",
            tenantId, id,
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

    fun setSites(tenantId: UUID, id: UUID, siteIds: Set<UUID>) {
        dsl.execute("delete from tenant_user_site where tenant_id = ? and user_id = ?", tenantId, id)
        siteIds.forEach { dsl.execute("insert into tenant_user_site (tenant_id, user_id, site_id) values (?, ?, ?)", tenantId, id, it) }
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

    /**
     * Quienes pueden resolver una incidencia de esa sede, de la más antigua a
     * la más reciente: lo que la lista ofrece es lo mismo que la asignación
     * acepta.
     */
    fun resolvers(tenantId: UUID, siteId: UUID?, after: PageKey?, limit: Int): List<UserRow> {
        val sql = StringBuilder("$SELECT where u.tenant_id = ? and $RESOLVER")
        val binds = mutableListOf<Any?>(tenantId, siteId)
        if (after != null) {
            sql.append(" and (u.created_at, u.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by u.created_at, u.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { row(it) }
    }

    fun canResolve(tenantId: UUID, id: UUID, siteId: UUID?): Boolean =
        dsl.fetchOne("select 1 as found from tenant_user u where u.tenant_id = ? and u.id = ? and $RESOLVER", tenantId, id, siteId) != null

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
        siteIds = r.get("site_ids", String::class.java).split(',').filter(String::isNotEmpty).map(UUID::fromString).toSet(),
    )

    private fun viewRow(r: Record) = row(r).copy(
        dossierPermission = r.get("dossier_permission", Boolean::class.javaObjectType) == true,
        dossierPermissionSince = r.get("dossier_permission_since", OffsetDateTime::class.java),
    )

    private companion object {
        /**
         * Con acceso vigente y con un rol que resuelve en esa sede:
         * Administración y RH en toda la empresa; Supervisión sólo en sus
         * sedes, y sin sede no resuelve. Lleva un parámetro: la sede.
         */
        const val RESOLVER =
            "u.status <> 'disabled' and (exists (select 1 from tenant_user_role r where r.tenant_id = u.tenant_id " +
                "and r.user_id = u.id and r.role in ('admin_empresa', 'rh')) or exists (select 1 from tenant_user_role r " +
                "join tenant_user_site s on s.tenant_id = r.tenant_id and s.user_id = r.user_id where r.tenant_id = u.tenant_id " +
                "and r.user_id = u.id and r.role = 'supervisor' and s.site_id = cast(? as uuid)))"
        const val COLUMNS =
            "u.tenant_id, u.id, u.email, u.subject, u.display_name, u.status, u.created_at, u.linked_at, u.employee_id, " +
                "coalesce((select string_agg(s.site_id::text, ',' order by s.site_id) from tenant_user_site s " +
                "where s.tenant_id = u.tenant_id and s.user_id = u.id), '') as site_ids, " +
                "coalesce((select string_agg(r.role, ',' order by r.role) from tenant_user_role r " +
                "where r.tenant_id = u.tenant_id and r.user_id = u.id), '') as roles"

        /** La búsqueda por identidad corre en cada petición: sin el permiso de expediente. */
        const val SELECT = "select $COLUMNS from tenant_user u"

        /** El permiso vale para la cuenta con la que se concedió: si la liga cambió, ya no. */
        const val PERMITTED = "coalesce(dp.enabled and dp.subject = u.subject and dp.linked_at = u.linked_at, false)"

        const val VIEW_FROM = "from tenant_user u left join dossier_permission dp on dp.tenant_id = u.tenant_id and dp.user_id = u.id"

        const val VIEW =
            "select $COLUMNS, $PERMITTED as dossier_permission, " +
                "case when $PERMITTED then dp.granted_at end as dossier_permission_since $VIEW_FROM"
    }
}
