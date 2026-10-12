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

    // Aquí importa la diferencia entre no mandar el campo y mandarlo nulo: nulo
    // apaga el cierre programado.
    private var autoCloseGiven = false
    var autoCloseAfterHours: Int? = null
        set(value) {
            field = value
            autoCloseGiven = true
        }

    fun changesAutoClose(): Boolean = autoCloseGiven
}

class TenantStatusRequest {
    var reason: String? = null
}

class AdministratorUnlinkRequest {
    var email: String? = null
    var reason: String? = null
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
        val autoClose = checks.whole("autoCloseAfterHours", request.autoCloseAfterHours, MIN_AUTO_CLOSE, MAX_AUTO_CLOSE, required = false)
        if (name == null && timeZone == null && weekStartsOn == null && breakPolicy == null && !request.changesAutoClose()) {
            checks.fail("", "empty_update", "Hay que cambiar al menos un campo.")
        }
        checks.done()

        val changed = listOfNotNull(
            name?.let { "name" },
            timeZone?.let { "timeZone" },
            weekStartsOn?.let { "weekStartsOn" },
            breakPolicy?.let { "breakPolicy" },
            "autoCloseAfterHours".takeIf { request.changesAutoClose() },
        )
        val tenant = tenants.update(tenantId, name, timeZone, weekStartsOn, breakPolicy, request.changesAutoClose(), autoClose)
            ?: throw Problems.notFound()
        audit.record(tenantId, person, "tenant.updated", "tenant", tenantId, mapOf("fields" to changed.joinToString(",")))
        return tenant
    }

    /**
     * Cierra la empresa para su propia gente y para sus dispositivos. No borra
     * ni cambia nada: al reactivarla todo sigue como estaba.
     */
    @Transactional
    fun suspend(operator: CurrentPerson, id: UUID, request: TenantStatusRequest): TenantRow =
        changeStatus(operator, id, request, "active", "suspended", "tenant.suspended") {
            Problems.conflict("tenant_not_active", "Esa empresa ya está suspendida.")
        }

    @Transactional
    fun reactivate(operator: CurrentPerson, id: UUID, request: TenantStatusRequest): TenantRow =
        changeStatus(operator, id, request, "suspended", "active", "tenant.reactivated") {
            Problems.conflict("tenant_not_suspended", "Esa empresa no está suspendida.")
        }

    /**
     * Suelta la liga de quien administra una empresa, para cuando esa persona
     * perdió su cuenta y nadie más de la empresa puede hacerlo. Es lo único que
     * quien opera el servicio hace sobre una persona de una empresa: sólo sobre
     * quien la administra, con un motivo, y queda en la bitácora de la empresa.
     * No devuelve nada de la persona.
     */
    @Transactional
    fun unlinkAdministrator(operator: CurrentPerson, id: UUID, request: AdministratorUnlinkRequest) {
        val checks = Checks()
        val email = checks.email("email", request.email)
        val reason = checks.text("reason", request.reason, MAX_REASON, required = true)
        if (reason != null && reason.length in 1 until MIN_REASON) checks.fail("reason", "too_short", "Lleva al menos $MIN_REASON caracteres.")
        checks.done()

        if (tenants.find(id) == null) throw Problems.notFound()
        tenants.lock(id)
        // Quien no administra esa empresa, o es de otra, no existe para esta operación: la respuesta no dice cuál.
        val user = users.findByEmail(id, email!!)?.takeIf { Role.ADMIN_EMPRESA.wire in it.roles } ?: throw Problems.notFound()
        if (!users.unlink(id, user.id)) throw Problems.conflict("user_not_linked", "Esa persona no está ligada a ninguna cuenta.")
        audit.record(id, operator, "user.unlinked", "user", user.id, mapOf("by" to "operator", "reason" to reason!!))
    }

    private fun changeStatus(
        operator: CurrentPerson,
        id: UUID,
        request: TenantStatusRequest,
        from: String,
        to: String,
        action: String,
        conflict: () -> RuntimeException,
    ): TenantRow {
        val checks = Checks()
        val reason = checks.text("reason", request.reason, MAX_REASON, required = true)
        if (reason != null && reason.length in 1 until MIN_REASON) checks.fail("reason", "too_short", "Lleva al menos $MIN_REASON caracteres.")
        checks.done()

        if (tenants.find(id) == null) throw Problems.notFound()
        // El cambio sólo ocurre si la empresa estaba en el estado del que se parte: dos peticiones a la vez no lo repiten.
        val tenant = tenants.setStatus(id, from, to) ?: throw conflict()
        // Queda en la bitácora de la propia empresa: quien la administra lo ve al volver.
        audit.record(id, operator, action, "tenant", id, mapOf("reason" to reason!!))
        return tenant
    }

    private companion object {
        const val MIN_AUTO_CLOSE = 1
        const val MAX_AUTO_CLOSE = 168
        const val MIN_REASON = 10
        const val MAX_REASON = 500
    }
}
