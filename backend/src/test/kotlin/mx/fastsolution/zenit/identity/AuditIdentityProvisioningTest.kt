package mx.fastsolution.zenit.identity

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.util.UUID
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.databind.node.ObjectNode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuditIdentityProvisioningTest {
    @Test
    fun `new auditors receive their required actions and existing accounts are left alone`() {
        val json = JsonMapper.builder().build()
        val id = UUID.randomUUID()
        val email = "auditor@example.invalid"
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        var account: JsonNode? = null
        var invitations = 0
        var creates = 0
        val actions = listOf("VERIFY_EMAIL", "UPDATE_PASSWORD", "CONFIGURE_TOTP")
        fun values(node: JsonNode): List<String> = (0 until node.size()).map { node.path(it).asText() }
        server.createContext("/") { exchange ->
            val uri = exchange.requestURI
            val payload = exchange.requestBody.readAllBytes().toString(Charsets.UTF_8)
            val response = when {
                uri.path.endsWith("/token") && exchange.requestMethod == "POST" ->
                    200 to """{"access_token":"service-token"}"""
                exchange.requestHeaders.getFirst("Authorization") != "Bearer service-token" ->
                    403 to ""
                uri.path.endsWith("/users") && exchange.requestMethod == "GET" ->
                    200 to json.writeValueAsString(listOfNotNull(account))
                uri.path.endsWith("/users") && exchange.requestMethod == "POST" -> {
                    creates++
                    account = (json.readTree(payload) as ObjectNode).also {
                        assertEquals(email, it.path("email").asText())
                        assertFalse(it.path("emailVerified").asBoolean())
                        assertTrue(it.path("credentials").isMissingNode)
                        assertEquals(actions, values(it.path("requiredActions")))
                    }.put("id", id.toString())
                    exchange.responseHeaders.add("Location", "http://127.0.0.1/users/$id")
                    201 to ""
                }
                uri.path.endsWith("/$id/execute-actions-email") && exchange.requestMethod == "PUT" -> {
                    invitations++
                    assertEquals(actions, values(json.readTree(payload)))
                    204 to ""
                }
                else -> 404 to ""
            }
            val bytes = response.second.toByteArray(Charsets.UTF_8)
            exchange.sendResponseHeaders(response.first, if (bytes.isEmpty()) -1 else bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()
        try {
            val service = AuditIdentityProvisioning(json, "http://127.0.0.1:${server.address.port}", "test-secret")
            service.prepare(email, "Auditor de Prueba")
            service.prepare(email, "Auditor de Prueba")
            assertEquals(1, creates)
            assertEquals(2, invitations)
            account = json.readTree("""{"email":"$email","username":"existente","enabled":true,"emailVerified":true}""")
            service.prepare(email, "Auditor de Prueba")
            assertEquals(1, creates)
            assertEquals(2, invitations)
        } finally {
            server.stop(0)
        }
    }
}
