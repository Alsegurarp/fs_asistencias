package mx.fastsolution.zenit.user

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.employee.EmployeeRepository
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
    var employeeId: String? = null
}

class UserUpdateRequest {
    var displayName: String? = null
    var roles: List<String>? = null
    var disabled: Boolean? = null

    // Aquí importa la diferencia entre no mandar el campo y mandarlo nulo: nulo
    // suelta a la persona de su fila del padrón.
    private var employeeIdGiven = false
    var employeeId: String? = null
        set(value) {
            field = value
            employeeIdGiven = true
        }

    fun changesEmployee(): Boolean = employeeIdGiven
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
    private val employees: EmployeeRepository,
    private val audit: AuditLog,
) {
    @Transactional
    fun invite(admin: CurrentPerson, request: UserCreateRequest): UserRow {
        val tenantId = admin.requireTenant()
        val checks = Checks()
        val email = checks.email("email", request.email)
        val displayName = checks.text("displayName", request.displayName, MAX_NAME, required = false) ?: ""
        val roles = parseRoles(checks, request.roles, required = true)
        val employeeId = checks.uuid("employeeId", request.employeeId, required = false)
        // Una fila del padrón de otra empresa no existe para quien pregunta.
        if (employeeId != null && employees.find(tenantId, employeeId) == null) {
            checks.fail("employeeId", "employee_not_found", "La persona del padrón no existe.")
        }
        checks.done()

        if (operators.isOperator(email!!)) throw Conflicts.emailUnavailable()

        val id = UUID.randomUUID()
        try {
            users.insertInvited(tenantId, id, email, displayName)
            if (employeeId != null) users.setEmployee(tenantId, id, employeeId)
            roles!!.forEach { users.grant(tenantId, id, it, admin.actorId) }
        } catch (e: RuntimeException) {
            throw when (Conflicts.uniqueConstraint(e)) {
                Conflicts.USER_EMAIL -> Conflicts.emailUnavailable()
                Conflicts.USER_EMPLOYEE -> Conflicts.employeeLinked()
                else -> e
            }
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
        val employeeId = checks.uuid("employeeId", request.employeeId, required = false)
        if (employeeId != null && employees.find(tenantId, employeeId) == null) {
            checks.fail("employeeId", "employee_not_found", "La persona del padrón no existe.")
        }
        if (displayName == null && roles == null && request.disabled == null && !request.changesEmployee()) {
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
        if (request.changesEmployee() && employeeId != before.employeeId) {
            try {
                users.setEmployee(tenantId, id, employeeId)
            } catch (e: RuntimeException) {
                throw if (Conflicts.uniqueConstraint(e) == Conflicts.USER_EMPLOYEE) Conflicts.employeeLinked() else e
            }
            audit.record(tenantId, admin, "user.updated", "user", id, mapOf("fields" to "employeeId"))
        }
        if (nextStatus != before.status) {
            users.setStatus(tenantId, id, nextStatus)
            audit.record(tenantId, admin, if (nextStatus == "disabled") "user.disabled" else "user.enabled", "user", id)
        }
        return users.find(tenantId, id)!!
    }

    /**
     * Suelta la liga entre la persona y su cuenta, para cuando la cuenta se
     * perdió y la persona tiene otra con el mismo correo. No quita el acceso:
     * la cuenta anterior, si todavía existe con ese correo verificado, vuelve
     * a ligarse al entrar. Para quitar el acceso está `disabled`.
     */
    @Transactional
    fun unlink(admin: CurrentPerson, id: UUID): UserRow {
        val tenantId = admin.requireTenant()
        tenants.lock(tenantId)
        if (users.find(tenantId, id) == null) throw Problems.notFound()
        if (!users.unlink(tenantId, id)) throw Problems.conflict("user_not_linked", "Esa persona no está ligada a ninguna cuenta.")
        audit.record(tenantId, admin, "user.unlinked", "user", id)
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
