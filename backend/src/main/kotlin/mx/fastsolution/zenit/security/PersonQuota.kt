package mx.fastsolution.zenit.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import mx.fastsolution.zenit.api.Correlation
import mx.fastsolution.zenit.capture.FixedWindowLimiter
import mx.fastsolution.zenit.identity.CurrentPerson
import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Duration

/** Límites del API que no dependen de una ruta. */
@ConfigurationProperties("zenit.api")
data class ApiProperties(
    /** Peticiones que se le aceptan a una persona por minuto, sumando todas sus sesiones. */
    val personRequestsPerMinute: Int = 600,
)

/**
 * Cuota por persona. Corre dentro de la cadena de seguridad, después de
 * verificar la credencial: cuenta a quien ya probó quién es, en cualquier
 * ruta. Los dispositivos tienen su propia cuota en la captura.
 *
 * La cuenta vive en memoria: vale mientras el backend corra en una sola
 * instancia.
 */
class PersonQuotaFilter(private val properties: ApiProperties, private val problems: SecurityProblemWriter) : OncePerRequestFilter() {
    private val log = LoggerFactory.getLogger(PersonQuotaFilter::class.java)
    private val requests = FixedWindowLimiter(Duration.ofMinutes(1))

    // Un aviso por persona y por minuto: una ráfaga no debe llenar los registros.
    private val warned = FixedWindowLimiter(Duration.ofMinutes(1))

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val person = SecurityContextHolder.getContext().authentication?.principal as? CurrentPerson
        if (person != null && !requests.tryAcquire(person.subject, properties.personRequestsPerMinute)) {
            if (warned.tryAcquire(person.subject, 1)) {
                log.warn("Cuota excedida: {} {} sujeto {} correlación {}", request.method, request.requestURI, person.subject, Correlation.of(request))
            }
            problems.tooManyRequests(request, response)
            return
        }
        chain.doFilter(request, response)
    }
}
