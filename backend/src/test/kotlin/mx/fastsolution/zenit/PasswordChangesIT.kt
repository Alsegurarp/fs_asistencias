package mx.fastsolution.zenit

import com.nimbusds.jwt.SignedJWT
import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.Tag
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import tools.jackson.databind.json.JsonMapper
import java.net.InetSocketAddress
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@Tag("integration")
class PasswordChangesIT : ApiTestBase() {
    companion object {
        private val providerJson = JsonMapper.builder().build()
        private var subject = ""
        private var providerEmail = ""
        private var actions = listOf("CONFIGURE_TOTP", "VERIFY_EMAIL")
        private var updates = 0
        private var calls = 0
        private var fail = false
        private var mismatch = false
        private var lastUpdate: Map<*, *> = emptyMap<String, Any>()
        private val provider = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/") { exchange ->
                calls++
                val body = exchange.requestBody.bufferedReader().readText()
                var status = 200
                val result: Any = when {
                    fail -> { status = 503; mapOf("error" to "PRIVATE_PROVIDER_DETAIL") }
                    exchange.requestURI.path.endsWith("/token") -> mapOf("access_token" to "isolated-provider-token")
                    exchange.requestHeaders.getFirst("Authorization") != "Bearer isolated-provider-token" -> { status = 401; emptyMap<String, Any>() }
                    exchange.requestURI.path.endsWith("/users/$subject") && exchange.requestMethod == "GET" ->
                        mapOf("id" to subject, "email" to if (mismatch) "other@example.invalid" else providerEmail, "enabled" to true, "emailVerified" to true, "requiredActions" to actions)
                    exchange.requestURI.path.endsWith("/users/$subject") && exchange.requestMethod == "PUT" -> {
                        lastUpdate = providerJson.readValue(body, Map::class.java)
                        @Suppress("UNCHECKED_CAST")
                        actions = lastUpdate["requiredActions"] as List<String>
                        updates++; status = 204; emptyMap<String, Any>()
                    }
                    else -> { status = 404; emptyMap<String, Any>() }
                }
                val bytes = providerJson.writeValueAsBytes(result)
                exchange.responseHeaders.add("Content-Type", "application/json")
                exchange.sendResponseHeaders(status, if (status == 204) -1 else bytes.size.toLong())
                if (status != 204) exchange.responseBody.write(bytes)
                exchange.close()
            }
            start()
        }

        @JvmStatic
        @DynamicPropertySource
        fun identityAdmin(registry: DynamicPropertyRegistry) {
            registry.add("zenit.identity-admin.url") { "http://127.0.0.1:${provider.address.port}" }
            registry.add("zenit.identity-admin.client-secret") { "isolated-test-secret" }
        }
    }

    @Test
    fun `only company administration can require a password change on its linked active accounts preserving other actions`() {
        val c = company()
        val user = member(c, "trabajador")
        subject = SignedJWT.parse(user.token).jwtClaimsSet.subject
        providerEmail = user.email
        actions = listOf("CONFIGURE_TOTP", "VERIFY_EMAIL"); calls = 0; updates = 0; fail = false; mismatch = false
        val route = "/api/v1/users/${user.id}/password-change"
        for (role in listOf("rh", "supervisor", "auditor", "trabajador")) {
            assertProblem(403, "forbidden", call("POST", route, member(c, role).token))
        }
        assertProblem(401, "unauthorized", call("POST", route))
        assertProblem(403, "forbidden", call("POST", route, operator))
        assertProblem(404, "not_found", call("POST", route, company().adminToken))
        assertProblem(404, "not_found", call("POST", "/api/v1/users/${UUID.randomUUID()}/password-change", c.adminToken))
        assertEquals(0, calls)
        assertEquals(204, call("POST", route, c.adminToken).status)
        assertEquals(listOf("CONFIGURE_TOTP", "VERIFY_EMAIL", "UPDATE_PASSWORD"), actions)
        assertEquals(setOf("requiredActions"), lastUpdate.keys)
        assertEquals(204, call("POST", route, c.adminToken).status)
        assertEquals(1, updates)

        mismatch = true
        assertProblem(503, "identity_unavailable", call("POST", route, c.adminToken))
        mismatch = false; fail = true
        val unavailable = call("POST", route, c.adminToken)
        assertProblem(503, "identity_unavailable", unavailable)
        assertFalse(unavailable.body.contains("PRIVATE_PROVIDER_DETAIL"))
        assertEquals(1, updates)
        fail = false
        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(2, audit.at<List<Any>>("items[?(@.action=='user.password_change_required')]").size)
        assertFalse(audit.body.contains(subject))

        assertEquals(200, call("PATCH", "/api/v1/users/${user.id}", c.adminToken, """{"disabled":true}""").status)
        val before = calls
        assertProblem(409, "user_not_active", call("POST", route, c.adminToken))
        val invited = call("POST", "/api/v1/users", c.adminToken, providerJson.writeValueAsString(mapOf("email" to email("invited"), "roles" to listOf("trabajador")))).at<String>("id")
        assertProblem(409, "user_not_linked", call("POST", "/api/v1/users/$invited/password-change", c.adminToken))
        assertEquals(before, calls)
        assertTrue(actions.contains("CONFIGURE_TOTP"))
    }
}
