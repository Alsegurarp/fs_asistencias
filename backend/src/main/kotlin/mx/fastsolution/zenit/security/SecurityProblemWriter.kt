package mx.fastsolution.zenit.security

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
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
import java.util.UUID

/**
 * Responde los rechazos de seguridad con el formato de error del contrato.
 * No dice por qué se rechazó la credencial: sólo que no sirve.
 */
@Component
class SecurityProblemWriter(private val clock: Clock = Clock.systemUTC()) :
    AuthenticationEntryPoint,
    AccessDeniedHandler {
    override fun commence(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authException: AuthenticationException,
    ) {
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
        write(response, HttpStatus.UNAUTHORIZED, "unauthorized", "Credencial no válida", serverTime = true)
    }

    override fun handle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        accessDeniedException: AccessDeniedException,
    ) {
        write(response, HttpStatus.FORBIDDEN, "forbidden", "Permiso insuficiente", serverTime = false)
    }

    private fun write(
        response: HttpServletResponse,
        status: HttpStatus,
        code: String,
        title: String,
        serverTime: Boolean,
    ) {
        // Todos los valores son fijos o generados aquí; nada viene de la petición.
        val fields = buildList {
            add("\"type\":\"https://zenit.invalid/problems/$code\"")
            add("\"title\":\"$title\"")
            add("\"status\":${status.value()}")
            add("\"code\":\"$code\"")
            add("\"correlationId\":\"${UUID.randomUUID()}\"")
            if (serverTime) add("\"serverTime\":\"${Instant.now(clock).truncatedTo(ChronoUnit.SECONDS)}\"")
        }
        response.status = status.value()
        response.contentType = "application/problem+json"
        response.characterEncoding = "UTF-8"
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        response.writer.write(fields.joinToString(",", "{", "}"))
    }
}
