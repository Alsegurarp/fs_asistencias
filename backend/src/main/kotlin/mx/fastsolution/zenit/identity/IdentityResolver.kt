package mx.fastsolution.zenit.identity

import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.tenant.TenantRepository
import mx.fastsolution.zenit.user.UserRepository
import mx.fastsolution.zenit.user.UserRow
import org.springframework.core.convert.converter.Converter
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** Lo que se toma de un token ya validado. */
data class TokenIdentity(
    val subject: String,
    val email: String?,
    val emailVerified: Boolean,
    val name: String,
) {
    /** Un correo sin verificar no identifica a nadie. */
    val verifiedEmail: String? get() = email?.trim()?.lowercase()?.takeIf { emailVerified && it.isNotEmpty() }
}

/**
 * Resuelve a quien llama contra las tablas del producto. El token sólo dice
 * quién es; la empresa y los roles salen de aquí.
 */
@Service
class IdentityResolver(
    private val users: UserRepository,
    private val tenants: TenantRepository,
    private val operators: OperatorProperties,
    private val audit: AuditLog,
) {
    @Transactional
    fun resolve(token: TokenIdentity): CurrentPerson {
        val email = token.verifiedEmail
        // Quien opera el servicio no pertenece a ninguna empresa.
        if (email != null && operators.isOperator(email)) {
            return CurrentPerson(token.subject, null, token.name, null, setOf(Role.OPERADOR_SAAS))
        }
        val user = users.findBySubject(token.subject) ?: email?.let { link(it, token) }
        if (user == null || user.status != "active" || tenants.find(user.tenantId)?.status != "active") {
            // Identidad válida sin acceso vigente: no entra a ninguna empresa.
            return CurrentPerson(token.subject, null, token.name, null, emptySet())
        }
        return CurrentPerson(
            subject = token.subject,
            userId = user.id,
            displayName = user.displayName.ifEmpty { token.name },
            tenantId = user.tenantId,
            roles = user.roles.mapNotNull(Role::ofTenant).toSet(),
            employeeId = user.employeeId,
        )
    }

    /** Primera entrada: liga la invitación hecha a ese correo con esta identidad. */
    private fun link(email: String, token: TokenIdentity): UserRow? {
        val linked = users.linkInvitation(email, token.subject, token.name)
        val user = users.findBySubject(token.subject) ?: return null
        if (linked) {
            val person = CurrentPerson(token.subject, user.id, user.displayName, user.tenantId, emptySet())
            audit.record(user.tenantId, person, "user.linked", "user", user.id)
        }
        return user
    }
}

@Component
class PersonAuthenticationConverter(private val resolver: IdentityResolver) : Converter<Jwt, AbstractAuthenticationToken> {
    override fun convert(jwt: Jwt): AbstractAuthenticationToken = PersonAuthentication(
        resolver.resolve(
            TokenIdentity(
                // El validador de tokens ya rechazó los que vienen sin sujeto.
                subject = requireNotNull(jwt.subject),
                email = jwt.getClaimAsString("email"),
                emailVerified = jwt.getClaimAsBoolean("email_verified") == true,
                name = jwt.getClaimAsString("name") ?: jwt.getClaimAsString("preferred_username") ?: "",
            ),
        ),
    )
}
