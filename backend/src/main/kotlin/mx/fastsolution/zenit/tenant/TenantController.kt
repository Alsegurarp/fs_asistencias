package mx.fastsolution.zenit.tenant

import com.fasterxml.jackson.annotation.JsonUnwrapped
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.identity.CurrentPerson
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

data class TenantView(
    val id: String,
    val name: String,
    val slug: String,
    val timeZone: String,
    val weekStartsOn: String,
    val breakPolicy: String,
    val status: String,
    val createdAt: String,
    val autoCloseAfterHours: Int?,
    /** El cambio de la política de comida que todavía no entra, si hay uno. */
    val breakPolicyChange: BreakPolicyChangeView?,
    /** Las formas de marcar del plan; las fija la operación del servicio. */
    val captureMethods: List<String>,
    /** La suspensión vigente: cuándo, quién y por qué. */
    val suspension: SuspensionView?,
) {
    companion object {
        /** `breakPolicy` es la que vale hoy en la empresa, no la de su alta: la da `BreakPolicies`. */
        fun of(row: TenantRow, breakPolicy: String, change: BreakPolicyChangeView?) = TenantView(
            id = row.id.toString(),
            name = row.name,
            slug = row.slug,
            timeZone = row.timeZone,
            weekStartsOn = row.weekStartsOn,
            breakPolicy = breakPolicy,
            status = row.status,
            createdAt = row.createdAt.toInstant().toString(),
            autoCloseAfterHours = row.autoCloseAfterHours,
            breakPolicyChange = change,
            captureMethods = row.captureMethods,
            suspension = row.suspension?.let { SuspensionView(it.at.toInstant().toString(), it.byName, it.reason) },
        )
    }
}

data class SuspensionView(val at: String, val byName: String, val reason: String)

data class TenantUsageView(
    val tenantId: String,
    val month: String,
    val timeZone: String,
    val from: String,
    val to: String,
    val complete: Boolean,
    val employeesWithAttendance: Int,
    val employeesInPeriod: Int,
    val cardsAssigned: Int,
    val devicesActive: Int,
    val attendanceEvents: Int,
) {
    companion object {
        fun of(usage: TenantUsage) = TenantUsageView(
            tenantId = usage.tenantId.toString(),
            month = usage.month,
            timeZone = usage.timeZone,
            from = usage.from.toInstant().toString(),
            to = usage.to.toInstant().toString(),
            complete = usage.complete,
            employeesWithAttendance = usage.counts.employeesWithAttendance,
            employeesInPeriod = usage.counts.employeesInPeriod,
            cardsAssigned = usage.counts.cardsAssigned,
            devicesActive = usage.counts.devicesActive,
            attendanceEvents = usage.counts.attendanceEvents,
        )
    }
}

/** Quien administra una empresa: su correo, su acceso y si ya entró. Sólo lo ve quien opera el servicio. */
data class TenantAdministratorView(
    val email: String,
    val status: String,
    val invitedAt: String,
    val linkedAt: String?,
) {
    companion object {
        fun of(administrator: TenantAdministrator) = TenantAdministratorView(
            email = administrator.email,
            status = administrator.status,
            invitedAt = administrator.invitedAt.toInstant().toString(),
            linkedAt = administrator.linkedAt?.toInstant()?.toString(),
        )
    }
}

data class TenantAdministrationView(
    val state: String,
    val total: Int,
    val administrators: List<TenantAdministratorView>,
)

/** La empresa vista desde la operación: sus datos y el estado de su administración. */
data class OperatedTenantView(
    @get:JsonUnwrapped val tenant: TenantView,
    val administration: TenantAdministrationView,
) {
    companion object {
        fun of(tenant: TenantView, state: String, administrators: List<TenantAdministrator>) = OperatedTenantView(
            tenant = tenant,
            administration = TenantAdministrationView(
                state = state,
                total = administrators.firstOrNull()?.total ?: 0,
                administrators = administrators.map(TenantAdministratorView::of),
            ),
        )
    }
}

/** Una fila del uso del mes de todas las empresas. */
data class TenantUsageItemView(
    val id: String,
    val name: String,
    val slug: String,
    val status: String,
    val usage: TenantUsageView,
) {
    companion object {
        fun of(usage: TenantUsage) = TenantUsageItemView(
            id = usage.tenant.id.toString(),
            name = usage.tenant.name,
            slug = usage.tenant.slug,
            status = usage.tenant.status,
            usage = TenantUsageView.of(usage),
        )
    }
}

data class TenantUsageSummaryView(
    val month: String,
    val tenants: Int,
    val complete: Int,
    val employeesWithAttendance: Long,
    val employeesInPeriod: Long,
    val cardsAssigned: Long,
    val devicesActive: Long,
    val attendanceEvents: Long,
) {
    companion object {
        fun of(month: String, totals: TenantUsageTotals) = TenantUsageSummaryView(
            month = month,
            tenants = totals.tenants,
            complete = totals.complete,
            employeesWithAttendance = totals.employeesWithAttendance,
            employeesInPeriod = totals.employeesInPeriod,
            cardsAssigned = totals.cardsAssigned,
            devicesActive = totals.devicesActive,
            attendanceEvents = totals.attendanceEvents,
        )
    }
}

/**
 * `/tenants` es de quien opera el servicio. `/tenant`, en singular, es la
 * empresa de quien llama: no recibe identificador, sale de su credencial.
 */
@RestController
@RequestMapping("/api/v1")
class TenantController(private val service: TenantService, private val policies: BreakPolicies) {
    @GetMapping("/tenants")
    fun list(
        @RequestParam q: String?,
        @RequestParam status: String?,
        @RequestParam administration: String?,
        @RequestParam breakPolicyChange: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<OperatedTenantView> {
        val size = Paging.limit(limit)
        val rows = service.page(TenantService.ListQuery(q, status, administration, breakPolicyChange), Paging.decode(cursor), size)
        // Lo de cada empresa de la página se lee en lote: un número fijo de consultas por página.
        val shown = rows.take(size).map { it.tenant }
        val views = policies.views(shown)
        val administrators = service.administrators(shown.map { it.id })
        return Paging.page(rows, size, { PageKey(it.tenant.createdAt, it.tenant.id) }) {
            OperatedTenantView.of(views.getValue(it.tenant.id), it.administration, administrators[it.tenant.id].orEmpty())
        }
    }

    @GetMapping("/tenants/summary")
    fun summary(@RequestParam q: String?): TenantListSummaryView = service.summary(q)

    @GetMapping("/tenants/usage")
    fun usageList(
        @RequestParam month: String?,
        @RequestParam q: String?,
        @RequestParam status: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<TenantUsageItemView> {
        val size = Paging.limit(limit)
        val rows = service.usagePage(TenantService.UsageQuery(month, q, status), Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.tenant.createdAt, it.tenant.id) }) { TenantUsageItemView.of(it) }
    }

    @GetMapping("/tenants/usage/summary")
    fun usageSummary(@RequestParam month: String?, @RequestParam q: String?, @RequestParam status: String?): TenantUsageSummaryView {
        val (period, totals) = service.usageTotals(TenantService.UsageQuery(month, q, status))
        return TenantUsageSummaryView.of(period, totals)
    }

    @PostMapping("/tenants/{tenantId}/administrators")
    @ResponseStatus(HttpStatus.CREATED)
    fun inviteAdministrator(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: AdministratorInviteRequest,
    ): TenantAdministratorView = TenantAdministratorView.of(service.inviteAdministrator(operator, tenantId, request))

    @PostMapping("/tenants")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal operator: CurrentPerson, @RequestBody request: TenantCreateRequest): TenantView =
        policies.view(service.create(operator, request))

    @PostMapping("/tenants/{tenantId}/suspension")
    fun suspend(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: TenantStatusRequest,
    ): TenantView = policies.view(service.suspend(operator, tenantId, request))

    @PostMapping("/tenants/{tenantId}/reactivation")
    fun reactivate(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: TenantStatusRequest,
    ): TenantView = policies.view(service.reactivate(operator, tenantId, request))

    @PostMapping("/tenants/{tenantId}/administrators/unlink")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unlinkAdministrator(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: AdministratorUnlinkRequest,
    ) {
        service.unlinkAdministrator(operator, tenantId, request)
    }

    @PutMapping("/tenants/{tenantId}/capture-methods")
    fun setCaptureMethods(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: Map<String, Any?>,
    ): TenantView = policies.view(service.setCaptureMethods(operator, tenantId, request))

    @GetMapping("/tenants/{tenantId}/usage")
    fun usage(@PathVariable tenantId: UUID, @RequestParam month: String?): TenantUsageView =
        TenantUsageView.of(service.usage(tenantId, month))

    @GetMapping("/tenant")
    fun current(@AuthenticationPrincipal person: CurrentPerson): TenantView = policies.view(service.current(person))

    @PatchMapping("/tenant")
    fun update(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: TenantUpdateRequest): TenantView =
        policies.view(service.update(person, request))
}
