package mx.fastsolution.zenit.identity

import org.junit.jupiter.api.AfterEach
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SiteScopeTest {
    @AfterEach
    fun clear() {
        SecurityContextHolder.clearContext()
        RequestContextHolder.resetRequestAttributes()
    }

    private fun authenticate(roles: Set<Role>, sites: Set<UUID> = emptySet()) {
        SecurityContextHolder.getContext().authentication = PersonAuthentication(
            CurrentPerson("subject", UUID.randomUUID(), "Persona", UUID.randomUUID(), roles, siteIds = sites))
    }

    @Test
    fun `supervisor without assigned sites gets no rows`() {
        authenticate(setOf(Role.SUPERVISOR))
        assertEquals(" and false", SiteScope.clause("site_id"))
    }

    @Test
    fun `supervisor has exactly the assigned UUID scope`() {
        val site = UUID.randomUUID()
        authenticate(setOf(Role.SUPERVISOR, Role.TRABAJADOR), setOf(site))
        assertEquals(setOf(site), SiteScope.current())
        assertEquals(" and site_id in ('$site'::uuid)", SiteScope.clause("site_id"))
    }

    @Test
    fun `explicit company-wide roles keep their scope when combined with supervisor`() {
        for (role in listOf(Role.ADMIN_EMPRESA, Role.RH)) {
            authenticate(setOf(Role.SUPERVISOR, role))
            assertNull(SiteScope.current())
            assertEquals("", SiteScope.clause("site_id"))
        }
    }

    @Test
    fun `auditor broadens reads without broadening supervisor writes`() {
        val site = UUID.randomUUID()
        authenticate(setOf(Role.SUPERVISOR, Role.AUDITOR), setOf(site))
        val request = MockHttpServletRequest("GET", "/api/v1/incidents")
        RequestContextHolder.setRequestAttributes(ServletRequestAttributes(request))
        assertNull(SiteScope.current())
        request.method = "PATCH"
        assertEquals(setOf(site), SiteScope.current())
        assertEquals(" and site_id in ('$site'::uuid)", SiteScope.clause("site_id"))
    }

    @Test
    fun `background work has no inherited HTTP site restriction`() {
        assertNull(SiteScope.current())
    }

    @Test
    fun `worker routes keep their separately authorized own access despite another supervisor role`() {
        authenticate(setOf(Role.SUPERVISOR, Role.TRABAJADOR))
        val own = MockHttpServletRequest("GET", "/api/v1/me/attendance")
        RequestContextHolder.setRequestAttributes(ServletRequestAttributes(own))
        assertNull(SiteScope.current())
        own.requestURI = "/api/v1/employees"
        assertEquals(emptySet(), SiteScope.current())
    }
}
