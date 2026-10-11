package mx.fastsolution.zenit.identity

import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
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
class MeController {
    /**
     * Quién llama, según su token. Todavía no hay tablas de empresa ni de rol:
     * una persona autenticada aparece sin empresa y sin roles, que es lo que
     * tiene hasta que se le asignen.
     */
    @GetMapping("/me")
    fun me(@AuthenticationPrincipal jwt: Jwt): CurrentUser = CurrentUser(
        // El validador de tokens ya rechazó los que vienen sin sujeto.
        userId = requireNotNull(jwt.subject),
        displayName = jwt.getClaimAsString("name") ?: jwt.getClaimAsString("preferred_username") ?: "",
        roles = emptyList(),
        tenant = null,
        employeeId = null,
    )
}
