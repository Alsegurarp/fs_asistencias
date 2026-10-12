package mx.fastsolution.zenit.security

import jakarta.servlet.FilterChain
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.PersonAuthentication
import mx.fastsolution.zenit.identity.Role
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@ExtendWith(OutputCaptureExtension::class)
class PersonQuotaFilterTest {
    private val filter = PersonQuotaFilter(ApiProperties(personRequestsPerMinute = 3), SecurityProblemWriter())

    @AfterEach
    fun forget() {
        SecurityContextHolder.clearContext()
    }

    private fun person(subject: String) =
        CurrentPerson(subject, UUID.randomUUID(), "Persona de prueba", UUID.randomUUID(), setOf(Role.RH))

    /** Una petición de esa persona, o sin credencial si es nula. Devuelve el estado y si llegó a la ruta. */
    private fun request(who: CurrentPerson?): Pair<MockHttpServletResponse, Boolean> {
        SecurityContextHolder.clearContext()
        if (who != null) SecurityContextHolder.getContext().authentication = PersonAuthentication(who)
        val response = MockHttpServletResponse()
        var reached = false
        filter.doFilter(MockHttpServletRequest("GET", "/api/v1/tenant"), response, FilterChain { _, _ -> reached = true })
        return response to reached
    }

    @Test
    fun `a person within the quota reaches the route, and beyond it is answered here`() {
        val one = person("sujeto-uno")
        repeat(3) { assertEquals(200 to true, request(one).let { it.first.status to it.second }) }

        val (refused, reached) = request(one)
        assertEquals(429 to false, refused.status to reached)
        assertEquals("application/problem+json;charset=UTF-8", refused.contentType)
        assertEquals("no-store", refused.getHeader("Cache-Control"))
        assertTrue("\"code\":\"rate_limited\"" in refused.contentAsString, refused.contentAsString)
        assertTrue("\"type\":\"https://zenit.invalid/problems/rate-limited\"" in refused.contentAsString)
        assertTrue("\"status\":429" in refused.contentAsString)
    }

    @Test
    fun `each person has their own count, and a request without a person is never counted`() {
        val one = person("sujeto-a")
        val other = person("sujeto-b")
        repeat(4) { request(one) }
        assertEquals(429, request(one).first.status)
        // Otra persona empieza de cero, y la misma con otra sesión no: la cuenta es de la persona.
        assertEquals(200 to true, request(other).let { it.first.status to it.second })
        assertEquals(429, request(person("sujeto-a")).first.status)
        repeat(10) { assertEquals(200 to true, request(null).let { it.first.status to it.second }) }
    }

    @Test
    fun `a burst leaves one warning per person, without the name`(output: CapturedOutput) {
        val noisy = person("sujeto-ruidoso")
        repeat(20) { request(noisy) }
        val warnings = output.out.lines().filter { "Cuota excedida" in it }
        assertEquals(1, warnings.size, output.out)
        assertTrue("sujeto-ruidoso" in warnings.single())
        assertTrue("Persona de prueba" !in output.out)
    }
}
