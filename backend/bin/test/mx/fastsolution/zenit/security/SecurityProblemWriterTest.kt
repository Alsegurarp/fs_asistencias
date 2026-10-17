package mx.fastsolution.zenit.security

import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.BadCredentialsException
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SecurityProblemWriterTest {
    private val writer = SecurityProblemWriter(Clock.fixed(Instant.parse("2026-10-05T13:00:01Z"), ZoneOffset.UTC))

    @Test
    fun `answers a missing credential with 401 and the server time`() {
        val response = MockHttpServletResponse()

        writer.commence(MockHttpServletRequest(), response, BadCredentialsException("detalle interno"))

        assertEquals(401, response.status)
        assertEquals("application/problem+json;charset=UTF-8", response.contentType)
        assertEquals("Bearer", response.getHeader("WWW-Authenticate"))
        val body = response.contentAsString
        assertTrue("\"code\":\"unauthorized\"" in body)
        assertTrue("\"serverTime\":\"2026-10-05T13:00:01Z\"" in body)
        assertFalse("detalle interno" in body)
    }

    @Test
    fun `answers an insufficient permission with 403 and no reason`() {
        val response = MockHttpServletResponse()

        writer.handle(MockHttpServletRequest(), response, AccessDeniedException("regla interna"))

        assertEquals(403, response.status)
        val body = response.contentAsString
        assertTrue("\"code\":\"forbidden\"" in body)
        assertFalse("serverTime" in body)
        assertFalse("regla interna" in body)
    }
}
