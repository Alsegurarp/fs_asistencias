package mx.fastsolution.zenit.tenant

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.OperatorProperties
import mx.fastsolution.zenit.identity.Role
import mx.fastsolution.zenit.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

class TenantCreateRequest {
    var name: String? = null
    var slug: String? = null
    var timeZone: String? = null
    var weekStartsOn: String? = null
    var breakPolicy: String? = null
    var firstAdminEmail: String? = null
}

class TenantUpdateRequest {
    var name: String? = null
    var timeZone: String? = null
    var weekStartsOn: String? = null
    var breakPolicy: String? = null
}

@Service
class TenantService(
    private val tenants: TenantRepository,
    private val users: UserRepository,
    private val operators: OperatorProperties,
    private val audit: AuditLog,
) {
    /**
     * Da de alta una empresa y deja invitada a la persona que la administrará.
     * Las dos cosas ocurren juntas: una empresa sin administrador no sirve.
     */
    @Transactional
    fun create(operator: CurrentPerson, request: TenantCreateRequest): TenantRow {
        val checks = Checks()
        val name = checks.text("name", request.name, 120, required = true)
        val slug = request.slug
        if (slug == null || slug.length > 60 || !Checks.SLUG.matches(slug)) {
            checks.fail("slug", "invalid_slug", "Minúsculas, números y guiones; hasta 60 caracteres.")
        }
        val timeZone = checks.timeZone("timeZone", request.timeZone, required = true)
        val weekStartsOn = checks.oneOf("weekStartsOn", request.weekStartsOn, Checks.WEEK_DAYS, required = true)
        val breakPolicy = checks.oneOf("breakPolicy", request.breakPolicy, Checks.BREAK_POLICIES, required = true)
        val email = checks.email("firstAdminEmail", request.firstAdminEmail)
        checks.done()

        // Quien opera el servicio no administra empresas con esa misma cuenta.
        if (operators.isOperator(email!!)) throw Conflicts.emailUnavailable()

        val tenantId = UUID.randomUUID()
        val adminId = UUID.randomUUID()
        try {
            val tenant = tenants.insert(tenantId, slug!!, name!!, timeZone!!, weekStartsOn!!, breakPolicy!!)
            users.insertInvited(tenantId, adminId, email, "")
            users.grant(tenantId, adminId, Role.ADMIN_EMPRESA.wire, operator.actorId)
            audit.record(tenantId, operator, "tenant.created", "tenant", tenantId)
            audit.record(tenantId, operator, "user.invited", "user", adminId, mapOf("roles" to Role.ADMIN_EMPRESA.wire))
            return tenant
        } catch (e: RuntimeException) {
            throw when (Conflicts.uniqueConstraint(e)) {
                Conflicts.TENANT_SLUG -> Conflicts.slugTaken()
                Conflicts.USER_EMAIL -> Conflicts.emailUnavailable()
                else -> e
            }
        }
    }

    @Transactional(readOnly = true)
    fun page(after: PageKey?, limit: Int): List<TenantRow> = tenants.page(after, limit + 1)

    @Transactional(readOnly = true)
    fun current(person: CurrentPerson): TenantRow = tenants.find(person.requireTenant()) ?: throw Problems.notFound()

    @Transactional
    fun update(person: CurrentPerson, request: TenantUpdateRequest): TenantRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val name = checks.text("name", request.name, 120, required = false)
        val timeZone = checks.timeZone("timeZone", request.timeZone, required = false)
        val weekStartsOn = checks.oneOf("weekStartsOn", request.weekStartsOn, Checks.WEEK_DAYS, required = false)
        val breakPolicy = checks.oneOf("breakPolicy", request.breakPolicy, Checks.BREAK_POLICIES, required = false)
        if (name == null && timeZone == null && weekStartsOn == null && breakPolicy == null) {
            checks.fail("", "empty_update", "Hay que cambiar al menos un campo.")
        }
        checks.done()

        val changed = listOfNotNull(
            name?.let { "name" },
            timeZone?.let { "timeZone" },
            weekStartsOn?.let { "weekStartsOn" },
            breakPolicy?.let { "breakPolicy" },
        )
        val tenant = tenants.update(tenantId, name, timeZone, weekStartsOn, breakPolicy) ?: throw Problems.notFound()
        audit.record(tenantId, person, "tenant.updated", "tenant", tenantId, mapOf("fields" to changed.joinToString(",")))
        return tenant
    }
}
