package mx.fastsolution.zenit.identity

import mx.fastsolution.zenit.api.Problems
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.AuthenticatedPrincipal
import org.springframework.security.core.authority.SimpleGrantedAuthority
import java.util.UUID

/**
 * Quien llama, ya resuelto contra las tablas del producto. La empresa sale de
 * aquí y de ningún otro lado: nunca del cuerpo ni de la ruta.
 */
data class CurrentPerson(
    /** Identificador de la persona en el proveedor de identidad. */
    val subject: String,
    /** Identificador en su empresa; nulo si no pertenece a ninguna. */
    val userId: UUID?,
    val displayName: String,
    val tenantId: UUID?,
    val roles: Set<Role>,
) : AuthenticatedPrincipal {
    override fun getName(): String = subject

    /** Con este identificador queda en la bitácora. */
    val actorId: String get() = userId?.toString() ?: subject

    /** Las rutas de empresa ya exigen un rol de empresa; esto lo vuelve a exigir. */
    fun requireTenant(): UUID = tenantId ?: throw Problems.forbidden()
}

/** Autenticación sin el token: después de validarlo no hace falta conservarlo. */
class PersonAuthentication(private val person: CurrentPerson) :
    AbstractAuthenticationToken(person.roles.map { SimpleGrantedAuthority("ROLE_${it.wire}") }) {
    init {
        isAuthenticated = true
    }

    override fun getCredentials(): Any = ""

    override fun getPrincipal(): Any = person
}
