package mx.fastsolution.zenit.dossier

import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.Role
import mx.fastsolution.zenit.tenant.TenantRepository
import org.jooq.DSLContext
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import java.time.OffsetDateTime
import java.util.UUID

data class DossierAccount(val tenantId: UUID, val userId: UUID, val subject: String, val linkedAt: OffsetDateTime)
data class DossierPermission(val enabled: Boolean)
class DossierPermissionRequest { var enabled: JsonNode? = null }

@Service
class DossierAccess(private val dsl: DSLContext, private val tenants: TenantRepository, private val audit: AuditLog) {
    /** Los bloqueos duran la operación: una revocación concurrente espera o ya se ve al entrar. */
    fun account(person: CurrentPerson): DossierAccount {
        val tenantId = person.requireTenant()
        val userId = person.userId ?: throw Problems.forbidden()
        if (person.roles.none { it.wire in Role.OF_TENANT }) throw Problems.forbidden()
        val row = dsl.fetchOne(
            "select u.subject, u.linked_at from tenant_user u join tenant t on t.id = u.tenant_id " +
                "where u.tenant_id = ? and u.id = ? and u.subject = ? and u.status = 'active' and t.status = 'active' " +
                "and exists (select 1 from tenant_user_role r where r.tenant_id = u.tenant_id and r.user_id = u.id) for share of t, u",
            tenantId, userId, person.subject,
        ) ?: throw Problems.forbidden()
        return DossierAccount(tenantId, userId, person.subject, row.get("linked_at", OffsetDateTime::class.java))
    }

    fun enabled(account: DossierAccount): Boolean = dsl.fetchOne(
        "select enabled, subject, linked_at from dossier_permission where tenant_id = ? and user_id = ? for share",
        account.tenantId, account.userId,
    )?.let {
        it.get("enabled", Boolean::class.java) == true && it.get("subject", String::class.java) == account.subject &&
            it.get("linked_at", OffsetDateTime::class.java).toInstant() == account.linkedAt.toInstant()
    } == true

    fun require(person: CurrentPerson): DossierAccount = account(person).also { if (!enabled(it)) throw Problems.forbidden() }

    @Transactional
    fun own(person: CurrentPerson) = DossierPermission(enabled(account(person)))

    @Transactional
    fun set(person: CurrentPerson, userId: UUID, request: DossierPermissionRequest): DossierPermission {
        if (Role.ADMIN_EMPRESA !in person.roles) throw Problems.forbidden()
        val tenantId = person.requireTenant()
        // Mismo orden que UserService: empresa, actor, destinatario y permiso.
        tenants.lock(tenantId)
        account(person)
        if (dsl.fetchOne("select 1 from tenant_user_role where tenant_id = ? and user_id = ? and role = 'admin_empresa'", tenantId, person.userId) == null) throw Problems.forbidden()
        val enabled = request.enabled?.takeIf { it.isBoolean }?.asBoolean()
            ?: throw Problems.validation("enabled", "invalid_type", "enabled debe ser un booleano JSON.")
        val user = dsl.fetchOne("select subject, linked_at, status from tenant_user where tenant_id = ? and id = ? for update", tenantId, userId)
            ?: throw Problems.notFound()
        val subject = user.get("subject", String::class.java)
        val linkedAt = user.get("linked_at", OffsetDateTime::class.java)
        if (enabled && subject == null) throw Problems.conflict("user_not_linked", "La persona debe vincular su cuenta.")
        if (enabled && user.get("status", String::class.java) != "active") throw Problems.conflict("user_not_active", "La cuenta debe estar activa.")
        val changed = dsl.execute(
            "insert into dossier_permission (tenant_id, user_id, enabled, subject, linked_at) values (?, ?, ?, ?, cast(? as timestamptz)) " +
                "on conflict (tenant_id, user_id) do update set enabled = excluded.enabled, subject = excluded.subject, " +
                "linked_at = excluded.linked_at, version = dossier_permission.version + 1 " +
                "where dossier_permission.enabled is distinct from excluded.enabled or " +
                "(excluded.enabled and (dossier_permission.subject, dossier_permission.linked_at) is distinct from (excluded.subject, excluded.linked_at))",
            tenantId, userId, enabled, subject, linkedAt,
        )
        if (changed > 0) audit.record(tenantId, person, if (enabled) "dossier.permission_granted" else "dossier.permission_revoked", "user", userId)
        return DossierPermission(enabled)
    }
}
