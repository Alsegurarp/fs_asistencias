package mx.fastsolution.zenit.tenant

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
) {
    companion object {
        fun of(row: TenantRow) = TenantView(
            id = row.id.toString(),
            name = row.name,
            slug = row.slug,
            timeZone = row.timeZone,
            weekStartsOn = row.weekStartsOn,
            breakPolicy = row.breakPolicy,
            status = row.status,
            createdAt = row.createdAt.toInstant().toString(),
            autoCloseAfterHours = row.autoCloseAfterHours,
        )
    }
}

/**
 * `/tenants` es de quien opera el servicio. `/tenant`, en singular, es la
 * empresa de quien llama: no recibe identificador, sale de su credencial.
 */
@RestController
@RequestMapping("/api/v1")
class TenantController(private val service: TenantService) {
    @GetMapping("/tenants")
    fun list(@RequestParam cursor: String?, @RequestParam limit: String?): Page<TenantView> {
        val size = Paging.limit(limit)
        return Paging.page(service.page(Paging.decode(cursor), size), size, { PageKey(it.createdAt, it.id) }) { TenantView.of(it) }
    }

    @PostMapping("/tenants")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal operator: CurrentPerson, @RequestBody request: TenantCreateRequest): TenantView =
        TenantView.of(service.create(operator, request))

    @PostMapping("/tenants/{tenantId}/suspension")
    fun suspend(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: TenantStatusRequest,
    ): TenantView = TenantView.of(service.suspend(operator, tenantId, request))

    @PostMapping("/tenants/{tenantId}/reactivation")
    fun reactivate(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: TenantStatusRequest,
    ): TenantView = TenantView.of(service.reactivate(operator, tenantId, request))

    @PostMapping("/tenants/{tenantId}/administrators/unlink")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unlinkAdministrator(
        @AuthenticationPrincipal operator: CurrentPerson,
        @PathVariable tenantId: UUID,
        @RequestBody request: AdministratorUnlinkRequest,
    ) {
        service.unlinkAdministrator(operator, tenantId, request)
    }

    @GetMapping("/tenant")
    fun current(@AuthenticationPrincipal person: CurrentPerson): TenantView = TenantView.of(service.current(person))

    @PatchMapping("/tenant")
    fun update(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: TenantUpdateRequest): TenantView =
        TenantView.of(service.update(person, request))
}
