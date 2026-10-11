package mx.fastsolution.zenit.user

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.OperatorProperties
import mx.fastsolution.zenit.identity.Role
import mx.fastsolution.zenit.tenant.TenantRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

class UserCreateRequest {
    var email: String? = null
    var displayName: String? = null
    var roles: List<String>? = null
}

class UserUpdateRequest {
    var displayName: String? = null
    var roles: List<String>? = null
    var disabled: Boolean? = null
}

/**
 * Personas con acceso al portal de una empresa. La cuenta, su contraseña y su
 * segundo factor viven en el proveedor de identidad; aquí sólo se decide a qué
 * correo se invita, con qué roles y si su acceso sigue vigente.
 */
@Service
class UserService(
    private val users: UserRepository,
    private val tenants: TenantRepository,
    private val operators: OperatorProperties,
    private val audit: AuditLog,
) {
    @Transactional
    fun invite(admin: CurrentPerson, request: UserCreateRequest): UserRow {
        val tenantId = admin.requireTenant()
        val checks = Checks()
        val email = checks.email("email", request.email)
        val displayName = checks.text("displayName", request.displayName, MAX_NAME, required = false) ?: ""
        val roles = parseRoles(checks, request.roles, required = true)
        checks.done()

        if (operators.isOperator(email!!)) throw Conflicts.emailUnavailable()

        val id = UUID.randomUUID()
        try {
            users.insertInvited(tenantId, id, email, displayName)
            roles!!.forEach { users.grant(tenantId, id, it, admin.actorId) }
        } catch (e: RuntimeException) {
            throw if (Conflicts.uniqueConstraint(e) == Conflicts.USER_EMAIL) Conflicts.emailUnavailable() else e
        }
        audit.record(tenantId, admin, "user.invited", "user", id, mapOf("roles" to roles.sorted().joinToString(",")))
        return users.find(tenantId, id)!!
    }

    @Transactional(readOnly = true)
    fun page(admin: CurrentPerson, after: PageKey?, limit: Int): List<UserRow> =
        users.page(admin.requireTenant(), after, limit + 1)

    @Transactional(readOnly = true)
    fun get(admin: CurrentPerson, id: UUID): UserRow = users.find(admin.requireTenant(), id) ?: throw Problems.notFound()

    @Transactional
    fun update(admin: CurrentPerson, id: UUID, request: UserUpdateRequest): UserRow {
        val tenantId = admin.requireTenant()
        val checks = Checks()
        val displayName = checks.text("displayName", request.displayName, MAX_NAME, required = false)
        val roles = parseRoles(checks, request.roles, required = false)
        if (displayName == null && roles == null && request.disabled == null) {
            checks.fail("", "empty_update", "Hay que cambiar al menos un campo.")
        }
        checks.done()

        // Dos cambios simultáneos no pueden dejar a la empresa sin quien la administre.
        tenants.lock(tenantId)
        val before = users.find(tenantId, id) ?: throw Problems.notFound()

        val nextRoles = roles ?: before.roles
        val nextStatus = when (request.disabled) {
            null -> before.status
            true -> "disabled"
            // Vuelve a como estaba: activa si ya entró alguna vez, invitada si no.
            false -> if (before.subject != null) "active" else "invited"
        }
        val administered = Role.ADMIN_EMPRESA.wire in before.roles && before.status != "disabled"
        val administers = Role.ADMIN_EMPRESA.wire in nextRoles && nextStatus != "disabled"
        if (administered && !administers && users.otherAdministrators(tenantId, id) == 0) {
            throw Problems.conflict("last_admin", "La empresa no puede quedarse sin una persona que la administre.")
        }

        if (displayName != null && displayName != before.displayName) {
            users.setDisplayName(tenantId, id, displayName)
            audit.record(tenantId, admin, "user.updated", "user", id, mapOf("fields" to "displayName"))
        }
        val added = nextRoles - before.roles
        val removed = before.roles - nextRoles
        if (added.isNotEmpty() || removed.isNotEmpty()) {
            removed.forEach { users.revoke(tenantId, id, it) }
            added.forEach { users.grant(tenantId, id, it, admin.actorId) }
            audit.record(
                tenantId, admin, "user.roles_changed", "user", id,
                mapOf("added" to added.sorted().joinToString(","), "removed" to removed.sorted().joinToString(",")),
            )
        }
        if (nextStatus != before.status) {
            users.setStatus(tenantId, id, nextStatus)
            audit.record(tenantId, admin, if (nextStatus == "disabled") "user.disabled" else "user.enabled", "user", id)
        }
        return users.find(tenantId, id)!!
    }

    private fun parseRoles(checks: Checks, raw: List<String>?, required: Boolean): Set<String>? {
        if (raw == null) {
            if (required) checks.fail("roles", "required", "Hay que dar al menos un rol.")
            return null
        }
        val roles = raw.toSet()
        when {
            roles.isEmpty() -> checks.fail("roles", "required", "Hay que dar al menos un rol.")
            !Role.OF_TENANT.containsAll(roles) ->
                checks.fail("roles", "invalid_value", "Valores admitidos: ${Role.OF_TENANT.joinToString(", ")}.")
        }
        return roles
    }

    private companion object {
        const val MAX_NAME = 120
    }
}
