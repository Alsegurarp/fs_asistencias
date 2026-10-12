package mx.fastsolution.zenit.security

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import mx.fastsolution.zenit.api.Correlation
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.AuthenticationException
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Responde los rechazos de seguridad con el formato de error del contrato.
 * No dice por qué se rechazó la credencial: sólo que no sirve.
 */
@Component
class SecurityProblemWriter(private val clock: Clock = Clock.systemUTC()) :
    AuthenticationEntryPoint,
    AccessDeniedHandler {
    private val log = LoggerFactory.getLogger(SecurityProblemWriter::class.java)

    override fun commence(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authException: AuthenticationException,
    ) {
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
        write(request, response, HttpStatus.UNAUTHORIZED, "unauthorized", "Credencial no válida", serverTime = true)
    }

    override fun handle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        accessDeniedException: AccessDeniedException,
    ) {
        // Deja rastro de quién intentó qué; el token nunca se registra.
        log.warn(
            "Acceso denegado: {} {} sujeto {} correlación {}",
            request.method, request.requestURI, request.userPrincipal?.name, Correlation.of(request),
        )
        write(request, response, HttpStatus.FORBIDDEN, "forbidden", "Permiso insuficiente", serverTime = false)
    }

    /** Quien llama agotó su cuota: se responde aquí, antes de llegar a la ruta. */
    fun tooManyRequests(request: HttpServletRequest, response: HttpServletResponse) {
        write(request, response, HttpStatus.TOO_MANY_REQUESTS, "rate_limited", "Demasiadas peticiones", serverTime = false, type = "rate-limited")
    }

    private fun write(
        request: HttpServletRequest,
        response: HttpServletResponse,
        status: HttpStatus,
        code: String,
        title: String,
        serverTime: Boolean,
        type: String = code,
    ) {
        // Todos los valores son fijos o generados aquí; nada viene de la petición.
        val fields = buildList {
            add("\"type\":\"https://zenit.invalid/problems/$type\"")
            add("\"title\":\"$title\"")
            add("\"status\":${status.value()}")
            add("\"code\":\"$code\"")
            add("\"correlationId\":\"${Correlation.of(request)}\"")
            if (serverTime) add("\"serverTime\":\"${Instant.now(clock).truncatedTo(ChronoUnit.SECONDS)}\"")
        }
        response.status = status.value()
        response.contentType = "application/problem+json"
        response.characterEncoding = "UTF-8"
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        response.writer.write(fields.joinToString(",", "{", "}"))
    }
}
