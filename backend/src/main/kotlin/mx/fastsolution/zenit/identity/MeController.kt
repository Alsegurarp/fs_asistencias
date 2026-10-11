package mx.fastsolution.zenit.identity

import mx.fastsolution.zenit.tenant.TenantRepository
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class TenantSummary(
    val id: String,
    val name: String,
    val timeZone: String,
    val weekStartsOn: String,
    val breakPolicy: String,
)

data class CurrentUser(
    val userId: String,
    val displayName: String,
    val roles: List<String>,
    val tenant: TenantSummary?,
    val employeeId: String?,
)

@RestController
@RequestMapping("/api/v1")
class MeController(private val tenants: TenantRepository) {
    /**
     * Quién llama, con su empresa y sus roles. Una identidad válida a la que
     * nadie ha invitado, o cuyo acceso se deshabilitó, aparece sin empresa y
     * sin roles: así el portal puede decírselo en lugar de fallar.
     */
    @GetMapping("/me")
    fun me(@AuthenticationPrincipal person: CurrentPerson): CurrentUser {
        val tenant = person.tenantId?.let(tenants::find)
        return CurrentUser(
            userId = person.actorId,
            displayName = person.displayName,
            roles = person.roles.map { it.wire }.sorted(),
            tenant = tenant?.let { TenantSummary(it.id.toString(), it.name, it.timeZone, it.weekStartsOn, it.breakPolicy) },
            employeeId = person.employeeId?.toString(),
        )
    }
}
