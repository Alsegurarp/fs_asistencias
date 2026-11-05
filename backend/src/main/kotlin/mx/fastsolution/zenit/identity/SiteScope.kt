package mx.fastsolution.zenit.identity

import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes
import java.util.UUID

/** Alcance de consulta común: se aplica antes de paginar, también al buscar por ID. */
object SiteScope {
    fun current(): Set<UUID>? {
        val request = (RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes)?.request
        // Estas dos rutas ya ligan el recurso al trabajador; su otro rol no le quita el acceso propio.
        if ((request?.method == "GET" && request.requestURI == "/api/v1/me/attendance") ||
            (request?.method == "POST" && Regex("^/api/v1/week-closures/[^/]+/acknowledgements$").matches(request.requestURI))) return null
        val person = SecurityContextHolder.getContext().authentication?.principal as? CurrentPerson ?: return null
        // Auditor amplía lectura, pero no las escrituras de su otro rol supervisor.
        if (request?.method == "GET" && Role.AUDITOR in person.roles) return null
        return person.takeIf { it.siteLimited }?.siteIds
    }

    // Sólo interpola UUID tipados que vienen de la base; column es un nombre interno fijo.
    fun clause(column: String): String = current()?.let { ids ->
        if (ids.isEmpty()) " and false" else " and $column in (${ids.joinToString(",") { "'$it'::uuid" }})"
    } ?: ""

    fun employee(column: String, tenantColumn: String): String = current()?.let {
        " and exists (select 1 from employee scope_employee where scope_employee.tenant_id = $tenantColumn " +
            "and scope_employee.id = $column${clause("scope_employee.site_id")})"
    } ?: ""
}
