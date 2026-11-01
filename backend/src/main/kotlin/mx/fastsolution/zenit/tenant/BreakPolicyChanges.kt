package mx.fastsolution.zenit.tenant

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.workday.WeekCalculator
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Cuándo entra un cambio de la política de comida: el primer día de semana de
 * la empresa dentro de la siguiente quincena (del 1 al 15 o del 16 al fin de
 * mes), siempre con al menos siete días de aviso contados hasta ese día. Si no
 * alcanzan, pasa a la quincena que sigue. Como entra en un inicio de semana,
 * ninguna semana mezcla dos políticas.
 */
object BreakPolicySchedule {
    const val NOTICE_DAYS = 7L

    fun effectiveOn(today: LocalDate, weekStartsOn: String): LocalDate {
        var quincena = nextQuincena(today)
        while (true) {
            // El primer inicio de semana en o después del día 1 o 16.
            val firstWeekStart = WeekCalculator.weekStart(quincena.plusDays(6), weekStartsOn)
            if (ChronoUnit.DAYS.between(today, firstWeekStart) >= NOTICE_DAYS) return firstWeekStart
            quincena = nextQuincena(quincena)
        }
    }

    /** Primer día de la quincena que sigue a la que contiene esa fecha. */
    fun nextQuincena(date: LocalDate): LocalDate =
        if (date.dayOfMonth < 16) date.withDayOfMonth(16) else date.plusMonths(1).withDayOfMonth(1)
}

data class BreakPolicyChangeRow(
    val id: UUID,
    val tenantId: UUID,
    val breakPolicy: String,
    val effectiveOn: LocalDate,
    val reason: String,
    val scheduledAt: OffsetDateTime,
)

class BreakPolicyChangeRequest {
    var breakPolicy: String? = null
    var reason: String? = null
}

/** El cambio programado, para quien administra la empresa o la opera. */
data class BreakPolicyChangeView(
    val id: String,
    val breakPolicy: String,
    val effectiveOn: String,
    val effectiveAt: String,
    val reason: String,
    val scheduledAt: String,
) {
    companion object {
        fun of(row: BreakPolicyChangeRow, timeZone: String) = BreakPolicyChangeView(
            id = row.id.toString(),
            breakPolicy = row.breakPolicy,
            effectiveOn = row.effectiveOn.toString(),
            effectiveAt = row.effectiveOn.atStartOfDay(ZoneId.of(timeZone)).toInstant().toString(),
            reason = row.reason,
            scheduledAt = row.scheduledAt.toInstant().toString(),
        )
    }
}

/** Lo que una persona o un dispositivo necesitan saber del cambio que viene: qué y cuándo, sin el motivo. */
data class UpcomingBreakPolicyView(val breakPolicy: String, val effectiveOn: String, val effectiveAt: String) {
    companion object {
        fun of(row: BreakPolicyChangeRow, timeZone: String) = UpcomingBreakPolicyView(
            breakPolicy = row.breakPolicy,
            effectiveOn = row.effectiveOn.toString(),
            effectiveAt = row.effectiveOn.atStartOfDay(ZoneId.of(timeZone)).toInstant().toString(),
        )
    }
}

@Repository
class BreakPolicyChangeRepository(private val dsl: DSLContext) {
    fun insert(tenantId: UUID, id: UUID, breakPolicy: String, effectiveOn: LocalDate, reason: String): BreakPolicyChangeRow =
        row(
            dsl.fetchOne(
                "insert into break_policy_change (tenant_id, id, break_policy, effective_on, reason) " +
                    "values (?, ?, ?, cast(? as date), ?) returning $COLUMNS",
                tenantId, id, breakPolicy, effectiveOn.toString(), reason,
            )!!,
        )

    /** La política del último cambio no cancelado que ya entró en esa fecha; nula si ninguno. */
    fun policyOn(tenantId: UUID, date: LocalDate): String? =
        dsl.fetchOne(
            "select break_policy from break_policy_change where tenant_id = ? and cancelled_at is null " +
                "and effective_on <= cast(? as date) order by effective_on desc limit 1",
            tenantId, date.toString(),
        )?.get("break_policy", String::class.java)

    /** El cambio que todavía no entra; a lo más hay uno. */
    fun pending(tenantId: UUID, today: LocalDate): BreakPolicyChangeRow? =
        dsl.fetchOne(
            "select $COLUMNS from break_policy_change where tenant_id = ? and cancelled_at is null " +
                "and effective_on > cast(? as date) order by effective_on limit 1",
            tenantId, today.toString(),
        )?.let(::row)

    fun find(tenantId: UUID, id: UUID): BreakPolicyChangeRow? =
        dsl.fetchOne("select $COLUMNS from break_policy_change where tenant_id = ? and id = ?", tenantId, id)?.let(::row)

    /** Cancela sólo si sigue pendiente; devuelve falso si ya entró o ya estaba cancelado. */
    fun cancel(tenantId: UUID, id: UUID, today: LocalDate): Boolean =
        dsl.execute(
            "update break_policy_change set cancelled_at = statement_timestamp() where tenant_id = ? and id = ? " +
                "and cancelled_at is null and effective_on > cast(? as date)",
            tenantId, id, today.toString(),
        ) == 1

    private fun row(r: Record) = BreakPolicyChangeRow(
        id = r.get("id", UUID::class.java),
        tenantId = r.get("tenant_id", UUID::class.java),
        breakPolicy = r.get("break_policy", String::class.java),
        effectiveOn = LocalDate.parse(r.get("effective_on", String::class.java)),
        reason = r.get("reason", String::class.java),
        scheduledAt = r.get("scheduled_at", OffsetDateTime::class.java),
    )

    private companion object {
        const val COLUMNS = "tenant_id, id, break_policy, cast(effective_on as text) as effective_on, reason, scheduled_at"
    }
}

/**
 * La política de comida que vale para una empresa en una fecha de su
 * calendario. Todo lo que decide qué es una marca la pide aquí, nunca a
 * `TenantRow` directamente.
 */
@Component
class BreakPolicies(private val changes: BreakPolicyChangeRepository) {
    fun on(tenant: TenantRow, date: LocalDate): String = changes.policyOn(tenant.id, date) ?: tenant.baseBreakPolicy

    fun today(tenant: TenantRow): LocalDate = LocalDate.now(ZoneId.of(tenant.timeZone))

    fun current(tenant: TenantRow): String = on(tenant, today(tenant))

    fun pending(tenant: TenantRow): BreakPolicyChangeRow? = changes.pending(tenant.id, today(tenant))

    fun upcoming(tenant: TenantRow): UpcomingBreakPolicyView? = pending(tenant)?.let { UpcomingBreakPolicyView.of(it, tenant.timeZone) }

    fun view(tenant: TenantRow): TenantView =
        TenantView.of(tenant, current(tenant), pending(tenant)?.let { BreakPolicyChangeView.of(it, tenant.timeZone) })
}

@Service
class BreakPolicyChangeService(
    private val tenants: TenantRepository,
    private val changes: BreakPolicyChangeRepository,
    private val policies: BreakPolicies,
    private val audit: AuditLog,
) {
    /**
     * Programa el cambio. Lo hace quien administra la empresa o quien opera el
     * servicio; la fecha la calcula el servicio, no se elige.
     */
    @Transactional
    fun schedule(person: CurrentPerson, tenantId: UUID, request: BreakPolicyChangeRequest): BreakPolicyChangeView {
        val checks = Checks()
        val breakPolicy = checks.oneOf("breakPolicy", request.breakPolicy, Checks.BREAK_POLICIES, required = true)
        val reason = checks.text("reason", request.reason, MAX_REASON, required = true)
        if (reason != null && reason.length in 1 until MIN_REASON) checks.fail("reason", "too_short", "Lleva al menos $MIN_REASON caracteres.")
        checks.done()

        if (tenants.find(tenantId) == null) throw Problems.notFound()
        // Dos peticiones a la vez no programan dos cambios.
        tenants.lock(tenantId)
        val tenant = tenants.find(tenantId)!!
        if (policies.pending(tenant) != null) throw pendingConflict()
        if (breakPolicy == policies.current(tenant)) {
            throw Problems.validation("breakPolicy", "same_break_policy", "La empresa ya tiene esa política.")
        }
        val effectiveOn = BreakPolicySchedule.effectiveOn(policies.today(tenant), tenant.weekStartsOn)
        val change = try {
            changes.insert(tenantId, UUID.randomUUID(), breakPolicy!!, effectiveOn, reason!!)
        } catch (e: RuntimeException) {
            if (Conflicts.uniqueConstraint(e) == Conflicts.BREAK_POLICY_CHANGE_DAY) throw pendingConflict() else throw e
        }
        audit.record(
            tenantId, person, "tenant.break_policy_change_scheduled", "break_policy_change", change.id,
            mapOf("breakPolicy" to change.breakPolicy, "effectiveOn" to change.effectiveOn.toString()),
        )
        return BreakPolicyChangeView.of(change, tenant.timeZone)
    }

    /** Cancela un cambio que todavía no entra. El que ya entró se corrige con otro cambio. */
    @Transactional
    fun cancel(person: CurrentPerson, tenantId: UUID, changeId: UUID) {
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        tenants.lock(tenantId)
        val change = changes.find(tenantId, changeId) ?: throw Problems.notFound()
        if (!changes.cancel(tenantId, change.id, policies.today(tenant))) {
            throw Problems.conflict("break_policy_change_not_pending", "Ese cambio ya entró o ya estaba cancelado.")
        }
        audit.record(
            tenantId, person, "tenant.break_policy_change_cancelled", "break_policy_change", change.id,
            mapOf("breakPolicy" to change.breakPolicy, "effectiveOn" to change.effectiveOn.toString()),
        )
    }

    private fun pendingConflict() =
        Problems.conflict("break_policy_change_pending", "Ya hay un cambio de la política de comida programado; cancélalo para programar otro.")

    private companion object {
        const val MIN_REASON = 10
        const val MAX_REASON = 500
    }
}

/**
 * Como en `TenantController`, `/tenant` es la empresa de quien llama y
 * `/tenants/{tenantId}` la usa quien opera el servicio.
 */
@RestController
@RequestMapping("/api/v1")
class BreakPolicyChangeController(private val service: BreakPolicyChangeService) {
    @PostMapping("/tenant/break-policy-changes")
    @ResponseStatus(HttpStatus.CREATED)
    fun schedule(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: BreakPolicyChangeRequest): BreakPolicyChangeView =
        service.schedule(person, person.requireTenant(), request)

    @PostMapping("/tenant/break-policy-changes/{changeId}/cancellation")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun cancel(@AuthenticationPrincipal person: CurrentPerson, @PathVariable changeId: UUID) {
        service.cancel(person, person.requireTenant(), changeId)
    }

    @PostMapping("/tenants/{tenantId}/break-policy-changes")
    @ResponseStatus(HttpStatus.CREATED)
    fun scheduleFor(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: BreakPolicyChangeRequest,
    ): BreakPolicyChangeView = service.schedule(operator, tenantId, request)

    @PostMapping("/tenants/{tenantId}/break-policy-changes/{changeId}/cancellation")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun cancelFor(@AuthenticationPrincipal operator: CurrentPerson, @PathVariable tenantId: UUID, @PathVariable changeId: UUID) {
        service.cancel(operator, tenantId, changeId)
    }
}
