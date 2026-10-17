package mx.fastsolution.zenit.api

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.MDC
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.context.request.RequestAttributes
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.filter.OncePerRequestFilter
import java.util.UUID

/**
 * Identificador de correlación de la petición. Lo genera el servidor: une la
 * respuesta de error, los registros y la bitácora. No se acepta el del cliente.
 */
object Correlation {
    const val ATTRIBUTE = "zenit.correlationId"

    fun of(request: HttpServletRequest): UUID = request.getAttribute(ATTRIBUTE) as? UUID ?: UUID.randomUUID()

    fun current(): UUID =
        RequestContextHolder.getRequestAttributes()?.getAttribute(ATTRIBUTE, RequestAttributes.SCOPE_REQUEST) as? UUID
            ?: UUID.randomUUID()
}

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class CorrelationFilter : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val id = UUID.randomUUID()
        request.setAttribute(Correlation.ATTRIBUTE, id)
        MDC.put("correlationId", id.toString())
        try {
            chain.doFilter(request, response)
        } finally {
            MDC.remove("correlationId")
        }
    }
}
