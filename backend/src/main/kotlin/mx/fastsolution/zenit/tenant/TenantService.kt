package mx.fastsolution.zenit.tenant

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.api.TextSearch
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.OperatorProperties
import mx.fastsolution.zenit.identity.Role
import mx.fastsolution.zenit.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZoneOffset
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

class TenantUsage(
    val tenantId: UUID,
    val month: String,
    val timeZone: String,
    val from: OffsetDateTime,
    val to: OffsetDateTime,
    val complete: Boolean,
    val counts: TenantUsageCounts,
    /** La empresa, para las listas de la consola. */
    val tenant: TenantRow,
)

class TenantStatusRequest {
    var reason: String? = null
}

class AdministratorUnlinkRequest {
    var email: String? = null
    var reason: String? = null
}

class AdministratorInviteRequest {
    var email: String? = null
    var reason: String? = null
}

@Service
class TenantService(
    private val tenants: TenantRepository,
    private val users: UserRepository,
    private val operators: OperatorProperties,
    private val audit: AuditLog,
    private val policies: BreakPolicies,
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

    data class ListQuery(val q: String? = null, val status: String? = null, val administration: String? = null)

    @Transactional(readOnly = true)
    fun page(query: ListQuery, after: PageKey?, limit: Int): List<OperatedTenantRow> =
        tenants.page(filter(query), after, limit + 1)

    @Transactional(readOnly = true)
    fun summary(q: String?): TenantListSummaryView {
        val checks = Checks()
        val text = TextSearch.pattern(checks, q)
        checks.done()
        return tenants.summary(text)
    }

    /** Quienes administran cada empresa de una página, en lote. */
    @Transactional(readOnly = true)
    fun administrators(ids: Collection<UUID>): Map<UUID, List<TenantAdministrator>> =
        tenants.administrators(ids, ADMINISTRATORS_SHOWN)

    /**
     * Invita a otra persona a administrar una empresa en la que nadie con ese
     * rol ha entrado o conserva su acceso: tras soltar la liga de quien la
     * administraba, o cuando la invitación del alta llegó a un correo
     * equivocado. Si alguien ya la administra con su cuenta, es esa persona
     * quien invita a las demás. Con el mismo control de correo que el alta,
     * un motivo, y en la bitácora de la empresa.
     */
    @Transactional
    fun inviteAdministrator(operator: CurrentPerson, id: UUID, request: AdministratorInviteRequest): TenantAdministrator {
        val checks = Checks()
        val email = checks.email("email", request.email)
        val reason = reason(checks, request.reason)
        checks.done()

        if (tenants.find(id) == null) throw Problems.notFound()
        if (operators.isOperator(email!!)) throw Conflicts.emailUnavailable()
        // En fila con soltar la liga y con otra invitación a la misma empresa.
        tenants.lock(id)
        if (tenants.administeredByLinked(id)) {
            throw Problems.conflict("administrator_linked", "La empresa ya tiene quien la administre con su cuenta; esa persona invita a las demás.")
        }
        val adminId = UUID.randomUUID()
        try {
            users.insertInvited(id, adminId, email, "")
        } catch (e: RuntimeException) {
            throw if (Conflicts.uniqueConstraint(e) == Conflicts.USER_EMAIL) Conflicts.emailUnavailable() else e
        }
        users.grant(id, adminId, Role.ADMIN_EMPRESA.wire, operator.actorId)
        audit.record(
            id, operator, "user.invited", "user", adminId,
            mapOf("roles" to Role.ADMIN_EMPRESA.wire, "by" to "operator", "reason" to reason!!),
        )
        val user = users.find(id, adminId)!!
        return TenantAdministrator(id, user.email, user.status, user.createdAt, user.linkedAt, total = 0)
    }

    data class UsageQuery(val month: String?, val q: String? = null, val status: String? = null)

    /** El uso del mes de las empresas que ya existían en él; sólo conteos. */
    @Transactional(readOnly = true)
    fun usagePage(query: UsageQuery, after: PageKey?, limit: Int): List<TenantUsage> {
        val (period, filter) = usageScope(query)
        return tenants.usagePage(period, filter, after, limit + 1).map { usageOf(period, it) }
    }

    /** Los totales de `usagePage` con los mismos filtros. */
    @Transactional(readOnly = true)
    fun usageTotals(query: UsageQuery): Pair<String, TenantUsageTotals> {
        val (period, filter) = usageScope(query)
        return period.toString() to tenants.usageTotals(period, filter)
    }

    @Transactional(readOnly = true)
    fun current(person: CurrentPerson): TenantRow = tenants.find(person.requireTenant()) ?: throw Problems.notFound()

    @Transactional
    fun update(person: CurrentPerson, request: TenantUpdateRequest): TenantRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val name = checks.text("name", request.name, 120, required = false)
        val timeZone = checks.timeZone("timeZone", request.timeZone, required = false)
        val weekStartsOn = checks.oneOf("weekStartsOn", request.weekStartsOn, Checks.WEEK_DAYS, required = false)
        // La política de comida ya no cambia al instante: reinterpretaría las semanas abiertas.
        if (request.breakPolicy != null) {
            checks.fail("breakPolicy", "scheduled_change_required", "La política de comida no cambia al instante; programa el cambio.")
        }
        val autoClose = checks.whole("autoCloseAfterHours", request.autoCloseAfterHours, MIN_AUTO_CLOSE, MAX_AUTO_CLOSE, required = false)
        if (name == null && timeZone == null && weekStartsOn == null && request.breakPolicy == null && !request.changesAutoClose()) {
            checks.fail("", "empty_update", "Hay que cambiar al menos un campo.")
        }
        checks.done()

        tenants.lock(tenantId)
        val before = tenants.find(tenantId) ?: throw Problems.notFound()
        // El cambio programado entra en un inicio de semana: moverlo partiría una semana en dos.
        if (weekStartsOn != null && weekStartsOn != before.weekStartsOn && policies.pending(before) != null) {
            throw Problems.conflict(
                "break_policy_change_pending",
                "Hay un cambio de la política de comida programado; cancélalo antes de cambiar el inicio de semana.",
            )
        }
        val changed = listOfNotNull(
            name?.let { "name" },
            timeZone?.let { "timeZone" },
            weekStartsOn?.let { "weekStartsOn" },
            "autoCloseAfterHours".takeIf { request.changesAutoClose() },
        )
        val tenant = tenants.update(tenantId, name, timeZone, weekStartsOn, request.changesAutoClose(), autoClose)
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
        val reason = reason(checks, request.reason)
        checks.done()

        if (tenants.find(id) == null) throw Problems.notFound()
        tenants.lock(id)
        // Quien no administra esa empresa, o es de otra, no existe para esta operación: la respuesta no dice cuál.
        val user = users.findByEmail(id, email!!)?.takeIf { Role.ADMIN_EMPRESA.wire in it.roles } ?: throw Problems.notFound()
        if (!users.unlink(id, user.id)) throw Problems.conflict("user_not_linked", "Esa persona no está ligada a ninguna cuenta.")
        audit.record(id, operator, "user.unlinked", "user", user.id, mapOf("by" to "operator", "reason" to reason!!))
    }

    /**
     * Lo que una empresa usó en un mes de su calendario, para facturar fuera
     * del servicio. Sólo son conteos: ningún dato de una persona sale de aquí.
     * Un mes terminado da siempre lo mismo; el mes en curso va creciendo.
     */
    @Transactional(readOnly = true)
    fun usage(id: UUID, month: String?): TenantUsage {
        val checks = Checks()
        val period = month(checks, month)
        checks.done()

        val tenant = tenants.find(id) ?: throw Problems.notFound()
        if (period!! > YearMonth.now(ZoneId.of(tenant.timeZone))) {
            Checks().apply { fail("month", "future_month", "Ese mes todavía no empieza para la empresa.") }.done()
        }
        return usageOf(period, tenants.usage(id, period))
    }

    private fun usageOf(period: YearMonth, usage: TenantMonthUsage) = TenantUsage(
        tenantId = usage.tenant.id,
        month = period.toString(),
        timeZone = usage.tenant.timeZone,
        from = usage.from,
        to = usage.to,
        complete = !OffsetDateTime.now().isBefore(usage.to),
        counts = usage.counts,
        tenant = usage.tenant,
    )

    /**
     * El mes de todas las empresas se acepta en cuanto empezó en la zona que
     * empieza el día primero; donde todavía no empieza, sus conteos van en
     * cero y `complete` es falso.
     */
    private fun usageScope(query: UsageQuery): Pair<YearMonth, TenantFilter> {
        val checks = Checks()
        val period = month(checks, query.month)
        val text = TextSearch.pattern(checks, query.q)
        val status = checks.oneOf("status", query.status, STATUSES, required = false)
        if (period != null && period > YearMonth.now(EARLIEST_ZONE)) {
            checks.fail("month", "future_month", "Ese mes todavía no empieza en ninguna zona horaria.")
        }
        checks.done()
        return period!! to TenantFilter(text, status)
    }

    private fun filter(query: ListQuery): TenantFilter {
        val checks = Checks()
        val text = TextSearch.pattern(checks, query.q)
        val status = checks.oneOf("status", query.status, STATUSES, required = false)
        val administration = checks.oneOf("administration", query.administration, TenantRepository.ADMINISTRATION_STATES.toSet(), required = false)
        checks.done()
        return TenantFilter(text, status, administration)
    }

    private fun month(checks: Checks, month: String?): YearMonth? {
        val period = month?.takeIf { MONTH.matches(it) }?.let { runCatching { YearMonth.parse(it) }.getOrNull() }
        if (period == null) checks.fail("month", "invalid_month", "El mes va en la forma AAAA-MM.")
        return period
    }

    private fun reason(checks: Checks, raw: String?): String? {
        val reason = checks.text("reason", raw, MAX_REASON, required = true)
        if (reason != null && reason.length in 1 until MIN_REASON) checks.fail("reason", "too_short", "Lleva al menos $MIN_REASON caracteres.")
        return reason
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
        val reason = reason(checks, request.reason)
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
        const val ADMINISTRATORS_SHOWN = 5
        val MONTH = Regex("[0-9]{4}-(0[1-9]|1[0-2])")
        val STATUSES = setOf("active", "suspended")

        /** La primera zona del mundo en empezar el día. */
        val EARLIEST_ZONE: ZoneOffset = ZoneOffset.ofHours(14)
    }
}
