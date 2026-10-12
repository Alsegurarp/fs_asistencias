package mx.fastsolution.zenit.api

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import org.slf4j.LoggerFactory
import org.springframework.mock.web.MockHttpServletRequest
import java.security.Principal
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class ProblemHandlerTest {
    @Test
    fun `a permission the route itself denies leaves a trace, without the token and without the query`() {
        val logger = LoggerFactory.getLogger(ProblemHandler::class.java) as Logger
        val lines = ListAppender<ILoggingEvent>().apply { start() }
        logger.addAppender(lines)
        try {
            val correlation = UUID.randomUUID()
            val request = MockHttpServletRequest("GET", "/api/v1/me/attendance").apply {
                queryString = "week=2026-10-05"
                addHeader("Authorization", "Bearer credencial-de-prueba")
                userPrincipal = Principal { "sujeto-de-prueba" }
                setAttribute(Correlation.ATTRIBUTE, correlation)
            }
            val handler = ProblemHandler()

            val denied = handler.known(Problems.forbidden(), request)

            assertEquals(403, denied.statusCode.value())
            val line = lines.list.single()
            assertEquals(Level.WARN, line.level)
            assertEquals("Acceso denegado: GET /api/v1/me/attendance sujeto sujeto-de-prueba correlación $correlation", line.formattedMessage)
            assertFalse("credencial-de-prueba" in line.formattedMessage)

            // Lo que no es un rechazo por permiso no deja ese rastro.
            handler.known(Problems.notFound(), request)
            handler.known(Problems.validation("week", "required", "Es obligatorio."), request)
            assertEquals(1, lines.list.size)
        } finally {
            logger.detachAppender(lines)
        }
    }
}
