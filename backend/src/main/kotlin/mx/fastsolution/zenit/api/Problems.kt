package mx.fastsolution.zenit.api

import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.AuthenticationException
import org.springframework.web.ErrorResponse
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.multipart.MultipartException

data class FieldError(val field: String, val code: String, val message: String)

/** Error que el API responde con el formato del contrato. */
class ApiException(
    val status: HttpStatus,
    val type: String,
    val code: String,
    val title: String,
    val detail: String? = null,
    val errors: List<FieldError> = emptyList(),
) : RuntimeException(code)

object Problems {
    // 422; el nombre de la constante cambió entre versiones de Spring.
    private val UNPROCESSABLE = HttpStatus.valueOf(422)

    fun notFound() = ApiException(HttpStatus.NOT_FOUND, "not-found", "not_found", "No encontrado")

    fun forbidden() = ApiException(HttpStatus.FORBIDDEN, "forbidden", "forbidden", "Permiso insuficiente")

    fun conflict(code: String, detail: String) =
        ApiException(HttpStatus.CONFLICT, "conflict", code, "Conflicto con el estado actual", detail)

    fun gone(code: String, detail: String) = ApiException(HttpStatus.GONE, "gone", code, "Ya no está disponible", detail)

    fun rateLimited() = ApiException(HttpStatus.TOO_MANY_REQUESTS, "rate-limited", "rate_limited", "Demasiadas peticiones")

    fun validation(errors: List<FieldError>) =
        ApiException(UNPROCESSABLE, "validation", "validation", "Datos no válidos", errors = errors)

    fun validation(field: String, code: String, message: String) = validation(listOf(FieldError(field, code, message)))
}

/**
 * Convierte los errores de las rutas al formato del contrato. Nunca copia a la
 * respuesta el mensaje de una excepción que no sea propia.
 */
@RestControllerAdvice
class ProblemHandler {
    private val log = LoggerFactory.getLogger(ProblemHandler::class.java)

    @ExceptionHandler(ApiException::class)
    fun known(e: ApiException, request: HttpServletRequest) = respond(e, request)

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadable(e: HttpMessageNotReadableException, request: HttpServletRequest) =
        respond(Problems.validation("", "unreadable_body", "El cuerpo no es JSON válido o trae campos que no existen."), request)

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun badIdentifier(e: MethodArgumentTypeMismatchException, request: HttpServletRequest) =
        respond(Problems.notFound(), request)

    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun tooLarge(e: MaxUploadSizeExceededException, request: HttpServletRequest) =
        respond(Problems.validation("file", "file_too_large", "El archivo excede el tamaño admitido."), request)

    @ExceptionHandler(MultipartException::class)
    fun notMultipart(e: MultipartException, request: HttpServletRequest) =
        respond(Problems.validation("file", "invalid_upload", "La petición debe ser multipart/form-data con un archivo."), request)

    @ExceptionHandler(Exception::class)
    fun unexpected(e: Exception, request: HttpServletRequest): ResponseEntity<Map<String, Any?>> {
        // Las decisiones de seguridad las responde la cadena de seguridad.
        if (e is AccessDeniedException || e is AuthenticationException) throw e
        // Rechazos del propio framework, como un tipo de contenido no admitido.
        if (e is ErrorResponse) {
            val status = HttpStatus.resolve(e.statusCode.value()) ?: HttpStatus.BAD_REQUEST
            return respond(ApiException(status, "request", "request_rejected", "Petición no admitida"), request)
        }
        log.error("Error no previsto, correlación {}", Correlation.of(request), e)
        return respond(
            ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "internal", "internal_error", "Error interno"),
            request,
        )
    }

    private fun respond(e: ApiException, request: HttpServletRequest): ResponseEntity<Map<String, Any?>> {
        val body = linkedMapOf<String, Any?>(
            "type" to "https://zenit.invalid/problems/${e.type}",
            "title" to e.title,
            "status" to e.status.value(),
            "code" to e.code,
            "correlationId" to Correlation.of(request).toString(),
        )
        if (e.detail != null) body["detail"] = e.detail
        if (e.errors.isNotEmpty()) body["errors"] = e.errors
        return ResponseEntity.status(e.status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(body)
    }
}
