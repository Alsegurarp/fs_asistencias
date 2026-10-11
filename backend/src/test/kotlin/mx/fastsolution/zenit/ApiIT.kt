package mx.fastsolution.zenit

import com.jayway.jsonpath.JsonPath
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.sun.net.httpserver.HttpServer
import org.flywaydb.core.Flyway
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.TestInstance
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.Path
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.interfaces.RSAPublicKey
import java.sql.DriverManager
import java.time.Instant
import java.util.Date
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Recorre el API por HTTP, contra PostgreSQL real y con tokens firmados que el
 * backend valida igual que los del proveedor de identidad: lee las claves de
 * una dirección, comprueba firma, vigencia, emisor y audiencia.
 *
 * Se corre con `docker compose --profile test run --rm backend-it`.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ApiIT {
    companion object {
        private const val KEY_ID = "prueba"
        private const val ISSUER = "http://identidad.invalid/realms/zenit"
        private const val OPERATOR = "operadora@zenit.invalid"
        private val keys: KeyPair by lazy { rsa() }
        private val port: Int by lazy { ServerSocket(0).use { it.localPort } }
        private val databaseUrl: String by lazy { System.getenv("IT_DB_URL") ?: error("Falta IT_DB_URL") }

        /** Publica la clave de prueba como lo hace el proveedor de identidad. */
        private val jwks: HttpServer by lazy {
            val body = JWKSet(RSAKey.Builder(keys.public as RSAPublicKey).keyID(KEY_ID).build()).toString().toByteArray()
            HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
                createContext("/certs") { exchange ->
                    exchange.responseHeaders.add("Content-Type", "application/json")
                    exchange.sendResponseHeaders(200, body.size.toLong())
                    exchange.responseBody.use { it.write(body) }
                }
                start()
            }
        }

        private fun rsa(): KeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()

        private fun secret(name: String): String = Files.readString(Path.of("/run/secrets", name)).trim()

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            // El backend no migra: el esquema se aplica antes, con el rol dueño.
            Flyway.configure()
                .dataSource(databaseUrl, "zenit_migrator", secret("db_migrator_password"))
                .locations("classpath:db/migration")
                .load()
                .migrate()
            registry.add("server.port") { port }
            registry.add("spring.datasource.url") { databaseUrl }
            registry.add("zenit.identity.issuer") { ISSUER }
            registry.add("zenit.identity.jwks-uri") { "http://127.0.0.1:${jwks.address.port}/certs" }
            registry.add("zenit.operators.emails") { OPERATOR }
        }
    }

    private val http = HttpClient.newHttpClient()

    private class Reply(val status: Int, val body: String, val contentType: String) {
        fun <T> at(path: String): T = JsonPath.read(body, "\$.$path")

        fun list(path: String): List<String> = at(path)

        override fun toString() = "$status $body"
    }

    private fun call(method: String, path: String, token: String? = null, body: String? = null): Reply {
        val request = HttpRequest.newBuilder(URI("http://127.0.0.1:$port$path"))
        if (token != null) request.header("Authorization", "Bearer $token")
        if (body != null) request.header("Content-Type", "application/json")
        request.method(method, body?.let { HttpRequest.BodyPublishers.ofString(it) } ?: HttpRequest.BodyPublishers.noBody())
        val response = http.send(request.build(), HttpResponse.BodyHandlers.ofString())
        return Reply(response.statusCode(), response.body(), response.headers().firstValue("Content-Type").orElse(""))
    }

    private fun token(
        subject: String,
        email: String?,
        verified: Boolean = true,
        audience: String = "zenit-api",
        issuer: String = ISSUER,
        expiresIn: Long = 300,
        signer: KeyPair = keys,
    ): String {
        val now = Instant.now()
        val claims = JWTClaimsSet.Builder()
            .subject(subject)
            .issuer(issuer)
            .audience(audience)
            .issueTime(Date.from(now.minusSeconds(5)))
            .expirationTime(Date.from(now.plusSeconds(expiresIn)))
            .claim("name", "Persona de prueba")
        if (email != null) {
            claims.claim("email", email)
            claims.claim("email_verified", verified)
        }
        val jwt = SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KEY_ID).build(), claims.build())
        jwt.sign(RSASSASigner(signer.private))
        return jwt.serialize()
    }

    private fun subject() = UUID.randomUUID().toString()

    private fun email(prefix: String) = "$prefix-${UUID.randomUUID().toString().take(8)}@zenit.invalid"

    private val operator: String get() = token("11111111-1111-4111-8111-111111111111", OPERATOR)

    private fun tenantBody(slug: String, adminEmail: String, extra: String = "") =
        """{"name":"Empresa $slug","slug":"$slug","timeZone":"America/Mexico_City","weekStartsOn":"monday",""" +
            """"breakPolicy":"not_considered","firstAdminEmail":"$adminEmail"$extra}"""

    private class Company(val id: String, val adminEmail: String, val adminToken: String, val adminId: String)

    /** Empresa nueva, con su primera administradora ya ligada. */
    private fun company(): Company {
        val slug = "empresa-${UUID.randomUUID().toString().take(8)}"
        val adminEmail = email("admin")
        val created = call("POST", "/api/v1/tenants", operator, tenantBody(slug, adminEmail))
        assertEquals(201, created.status, created.toString())
        val adminToken = token(subject(), adminEmail)
        val me = call("GET", "/api/v1/me", adminToken)
        assertEquals(200, me.status, me.toString())
        return Company(created.at("id"), adminEmail, adminToken, me.at("userId"))
    }

    private class Member(val id: String, val email: String, val token: String)

    /** Persona invitada a la empresa, que ya entró por primera vez. */
    private fun member(company: Company, vararg roles: String): Member {
        val address = email(roles.first())
        val invited = call(
            "POST", "/api/v1/users", company.adminToken,
            """{"email":"$address","displayName":"Persona ${roles.first()}","roles":[${roles.joinToString(",") { "\"$it\"" }}]}""",
        )
        assertEquals(201, invited.status, invited.toString())
        assertEquals("invited", invited.at("status"))
        val token = token(subject(), address)
        assertEquals(200, call("GET", "/api/v1/me", token).status)
        return Member(invited.at("id"), address, token)
    }

    private fun assertProblem(expectedStatus: Int, expectedCode: String, reply: Reply) {
        assertEquals(expectedStatus, reply.status, reply.toString())
        assertTrue(reply.contentType.startsWith("application/problem+json"), reply.contentType)
        assertEquals(expectedCode, reply.at("code"))
        assertEquals(expectedStatus, reply.at("status"))
        UUID.fromString(reply.at("correlationId"))
    }

    @Test
    fun `every new route asks for a credential`() {
        val routes = listOf(
            "GET" to "/api/v1/me", "GET" to "/api/v1/tenants", "POST" to "/api/v1/tenants", "GET" to "/api/v1/tenant",
            "PATCH" to "/api/v1/tenant", "GET" to "/api/v1/users", "POST" to "/api/v1/users",
            "GET" to "/api/v1/users/${UUID.randomUUID()}", "PATCH" to "/api/v1/users/${UUID.randomUUID()}",
            "GET" to "/api/v1/audit-log",
        )
        for ((method, path) in routes) {
            assertProblem(401, "unauthorized", call(method, path, body = if (method == "GET") null else "{}"))
        }
    }

    @Test
    fun `a token must be signed by the provider, current and meant for this api`() {
        val address = email("firma")
        assertEquals(200, call("GET", "/api/v1/me", token(subject(), address)).status)

        assertProblem(401, "unauthorized", call("GET", "/api/v1/me", token(subject(), address, signer = rsa())))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/me", token(subject(), address, audience = "otra-api")))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/me", token(subject(), address, issuer = "http://otro.invalid/realms/zenit")))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/me", token(subject(), address, expiresIn = -120)))
        val tampered = token(subject(), OPERATOR).let { it.dropLast(4) + if (it.endsWith("AAAA")) "BBBB" else "AAAA" }
        assertProblem(401, "unauthorized", call("GET", "/api/v1/tenants", tampered))
    }

    @Test
    fun `only someone on the operator list registers and lists companies`() {
        val stranger = token(subject(), email("ajena"))
        assertProblem(403, "forbidden", call("GET", "/api/v1/tenants", stranger))
        assertProblem(403, "forbidden", call("POST", "/api/v1/tenants", stranger, tenantBody("ajena", email("x"))))
        // El correo de la lista, pero sin verificar, no opera.
        assertProblem(403, "forbidden", call("GET", "/api/v1/tenants", token(subject(), OPERATOR, verified = false)))

        val me = call("GET", "/api/v1/me", operator)
        assertEquals(listOf("operador_saas"), me.list("roles"))
        assertNull(me.at<Any?>("tenant"))
        // Quien opera el servicio no entra a los datos de ninguna empresa.
        assertProblem(403, "forbidden", call("GET", "/api/v1/tenant", operator))
        assertProblem(403, "forbidden", call("GET", "/api/v1/users", operator))
        assertProblem(403, "forbidden", call("GET", "/api/v1/audit-log", operator))

        val one = company()
        var cursor: String? = null
        val seen = mutableListOf<String>()
        do {
            val page = call("GET", "/api/v1/tenants?limit=200" + (cursor?.let { "&cursor=$it" } ?: ""), operator)
            assertEquals(200, page.status, page.toString())
            seen += page.list("items[*].id")
            cursor = page.at("nextCursor")
        } while (cursor != null)
        assertTrue(one.id in seen)
        assertEquals(seen.size, seen.toSet().size)
    }

    @Test
    fun `the first administrator is linked on first entry and nobody else takes the invitation`() {
        val slug = "empresa-${UUID.randomUUID().toString().take(8)}"
        val adminEmail = email("primera")
        val created = call("POST", "/api/v1/tenants", operator, tenantBody(slug, adminEmail.uppercase()))
        assertEquals(201, created.status, created.toString())
        assertEquals("active", created.at("status"))

        // Sin verificar, ese correo no liga a nadie.
        val unverified = token(subject(), adminEmail, verified = false)
        val nobody = call("GET", "/api/v1/me", unverified)
        assertEquals(emptyList(), nobody.list("roles"))
        assertNull(nobody.at<Any?>("tenant"))
        assertProblem(403, "forbidden", call("GET", "/api/v1/tenant", unverified))

        val adminSubject = subject()
        val admin = token(adminSubject, adminEmail)
        val me = call("GET", "/api/v1/me", admin)
        assertEquals(listOf("admin_empresa"), me.list("roles"))
        assertEquals(created.at<String>("id"), me.at("tenant.id"))
        assertEquals("not_considered", me.at("tenant.breakPolicy"))
        assertEquals("Persona de prueba", me.at("displayName"))
        assertNotEquals(adminSubject, me.at<String>("userId"))
        assertEquals(me.body, call("GET", "/api/v1/me", admin).body)

        // Otra identidad con el mismo correo llega tarde: la invitación ya tiene dueña.
        val late = call("GET", "/api/v1/me", token(subject(), adminEmail))
        assertEquals(emptyList(), late.list("roles"))
        assertNull(late.at<Any?>("tenant"))

        val audit = call("GET", "/api/v1/audit-log", admin)
        assertEquals(200, audit.status, audit.toString())
        assertEquals(listOf("user.linked", "user.invited", "tenant.created").sorted(), audit.list("items[*].action").sorted())
        val linked = call("GET", "/api/v1/audit-log?action=user.linked", admin)
        assertEquals(1, linked.at<Int>("items.length()"))
        assertEquals(me.at<String>("userId"), linked.at("items[0].actor.id"))
        assertEquals("user", linked.at("items[0].target.type"))
        UUID.fromString(linked.at("items[0].correlationId"))
    }

    @Test
    fun `two companies do not see or change each other`() {
        val a = company()
        val b = company()
        val rhOfA = member(a, "rh")

        val usersOfA = call("GET", "/api/v1/users", a.adminToken)
        assertEquals(setOf(a.adminEmail, rhOfA.email), usersOfA.list("items[*].email").toSet())
        assertEquals(setOf(b.adminEmail), call("GET", "/api/v1/users", b.adminToken).list("items[*].email").toSet())

        // Lo de otra empresa no existe: ni se lee ni se cambia.
        assertProblem(404, "not_found", call("GET", "/api/v1/users/${b.adminId}", a.adminToken))
        assertProblem(404, "not_found", call("PATCH", "/api/v1/users/${b.adminId}", a.adminToken, """{"disabled":true}"""))
        assertProblem(404, "not_found", call("PATCH", "/api/v1/users/${b.adminId}", a.adminToken, """{"roles":["trabajador"]}"""))
        val adminOfB = call("GET", "/api/v1/users/${b.adminId}", b.adminToken)
        assertEquals("active", adminOfB.at("status"))
        assertEquals(listOf("admin_empresa"), adminOfB.list("roles"))

        assertEquals(a.id, call("GET", "/api/v1/tenant", a.adminToken).at("id"))
        assertEquals(a.id, call("GET", "/api/v1/tenant", rhOfA.token).at("id"))
        assertEquals(b.id, call("GET", "/api/v1/tenant", b.adminToken).at("id"))
        val renamed = call("PATCH", "/api/v1/tenant", a.adminToken, """{"name":"Renombrada por A","weekStartsOn":"sunday"}""")
        assertEquals(200, renamed.status, renamed.toString())
        assertEquals("Renombrada por A", renamed.at("name"))
        val tenantOfB = call("GET", "/api/v1/tenant", b.adminToken)
        assertNotEquals("Renombrada por A", tenantOfB.at<String>("name"))
        assertEquals("monday", tenantOfB.at("weekStartsOn"))

        // Un correo pertenece a una sola empresa, y la respuesta no dice dónde está.
        val taken = call("POST", "/api/v1/users", a.adminToken, """{"email":"${b.adminEmail}","roles":["rh"]}""")
        assertProblem(409, "email_unavailable", taken)
        assertFalse(b.id in taken.body)
        assertProblem(409, "email_unavailable", call("POST", "/api/v1/users", a.adminToken, """{"email":"$OPERATOR","roles":["rh"]}"""))

        val auditOfA = call("GET", "/api/v1/audit-log", a.adminToken)
        val auditOfB = call("GET", "/api/v1/audit-log", b.adminToken)
        assertTrue("tenant.updated" in auditOfA.list("items[*].action"))
        assertFalse("tenant.updated" in auditOfB.list("items[*].action"))
        assertFalse(b.id in auditOfA.body || b.adminId in auditOfA.body)
        assertFalse(a.id in auditOfB.body || a.adminId in auditOfB.body || rhOfA.id in auditOfB.body)
    }

    @Test
    fun `each route admits only the roles the contract gives it`() {
        val c = company()
        val people = mapOf(
            "admin_empresa" to c.adminToken,
            "rh" to member(c, "rh").token,
            "supervisor" to member(c, "supervisor").token,
            "auditor" to member(c, "auditor").token,
            "trabajador" to member(c, "trabajador").token,
        )
        fun expect(method: String, path: String, body: String?, vararg allowed: String) {
            for ((role, token) in people) {
                val reply = call(method, path, token, body)
                if (role in allowed) {
                    assertTrue(reply.status in 200..299, "$role $method $path: $reply")
                } else {
                    assertProblem(403, "forbidden", reply)
                }
            }
        }
        expect("GET", "/api/v1/me", null, "admin_empresa", "rh", "supervisor", "auditor", "trabajador")
        expect("GET", "/api/v1/tenant", null, "admin_empresa", "rh", "supervisor", "auditor")
        expect("PATCH", "/api/v1/tenant", """{"breakPolicy":"marked"}""", "admin_empresa")
        expect("GET", "/api/v1/users", null, "admin_empresa")
        expect("GET", "/api/v1/users/${c.adminId}", null, "admin_empresa")
        expect("POST", "/api/v1/users", """{"email":"${email("matriz")}","roles":["trabajador"]}""", "admin_empresa")
        expect("PATCH", "/api/v1/users/${c.adminId}", """{"displayName":"Administradora"}""", "admin_empresa")
        expect("GET", "/api/v1/audit-log", null, "admin_empresa", "auditor")
        expect("GET", "/api/v1/tenants", null)
        expect("POST", "/api/v1/tenants", tenantBody("no-debe-existir", email("x")))
        // Lo que no está abierto sigue cerrado, también para quien administra.
        expect("DELETE", "/api/v1/users/${c.adminId}", null)
        expect("GET", "/api/v1/employees", null)

        // Una persona puede tener varios roles a la vez.
        val both = member(c, "rh", "auditor")
        assertEquals(listOf("auditor", "rh"), call("GET", "/api/v1/me", both.token).list("roles"))
        assertEquals(200, call("GET", "/api/v1/audit-log", both.token).status)
    }

    @Test
    fun `a company cannot be left without an administrator`() {
        val c = company()
        assertProblem(409, "last_admin", call("PATCH", "/api/v1/users/${c.adminId}", c.adminToken, """{"roles":["rh"]}"""))
        assertProblem(409, "last_admin", call("PATCH", "/api/v1/users/${c.adminId}", c.adminToken, """{"disabled":true}"""))
        assertEquals(listOf("admin_empresa"), call("GET", "/api/v1/me", c.adminToken).list("roles"))

        // Con otra persona que administre, la primera sí puede dejar de hacerlo.
        val second = member(c, "admin_empresa")
        val demoted = call("PATCH", "/api/v1/users/${c.adminId}", c.adminToken, """{"roles":["rh"]}""")
        assertEquals(200, demoted.status, demoted.toString())
        assertEquals(listOf("rh"), demoted.list("roles"))
        assertProblem(403, "forbidden", call("GET", "/api/v1/users", c.adminToken))
        assertProblem(409, "last_admin", call("PATCH", "/api/v1/users/${second.id}", second.token, """{"disabled":true}"""))

        val changes = call("GET", "/api/v1/audit-log?action=user.roles_changed", second.token)
        assertEquals(1, changes.at<Int>("items.length()"))
        assertEquals("rh", changes.at("items[0].metadata.added"))
        assertEquals("admin_empresa", changes.at("items[0].metadata.removed"))
        assertEquals(c.adminId, changes.at("items[0].target.id"))
    }

    @Test
    fun `a disabled person loses access and gets it back when enabled`() {
        val c = company()
        val rh = member(c, "rh")
        assertEquals(200, call("GET", "/api/v1/tenant", rh.token).status)

        val disabled = call("PATCH", "/api/v1/users/${rh.id}", c.adminToken, """{"disabled":true}""")
        assertEquals("disabled", disabled.at("status"))
        assertProblem(403, "forbidden", call("GET", "/api/v1/tenant", rh.token))
        val me = call("GET", "/api/v1/me", rh.token)
        assertEquals(emptyList(), me.list("roles"))
        assertNull(me.at<Any?>("tenant"))

        assertEquals("active", call("PATCH", "/api/v1/users/${rh.id}", c.adminToken, """{"disabled":false}""").at("status"))
        assertEquals(200, call("GET", "/api/v1/tenant", rh.token).status)

        // Quien nunca entró vuelve a quedar invitada, no activa.
        val pending = call("POST", "/api/v1/users", c.adminToken, """{"email":"${email("pendiente")}","roles":["supervisor"]}""")
        val pendingId = pending.at<String>("id")
        assertNull(pending.at<Any?>("linkedAt"))
        assertEquals("disabled", call("PATCH", "/api/v1/users/$pendingId", c.adminToken, """{"disabled":true}""").at("status"))
        assertEquals("invited", call("PATCH", "/api/v1/users/$pendingId", c.adminToken, """{"disabled":false}""").at("status"))
    }

    @Test
    fun `a suspended company is closed to its own people`() {
        val c = company()
        assertEquals(200, call("GET", "/api/v1/tenant", c.adminToken).status)

        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement("UPDATE tenant SET status = 'suspended' WHERE id = ?").use {
                it.setObject(1, UUID.fromString(c.id))
                assertEquals(1, it.executeUpdate())
            }
        }

        assertProblem(403, "forbidden", call("GET", "/api/v1/tenant", c.adminToken))
        assertProblem(403, "forbidden", call("GET", "/api/v1/users", c.adminToken))
        assertEquals(emptyList(), call("GET", "/api/v1/me", c.adminToken).list("roles"))
    }

    @Test
    fun `invalid requests are rejected in the contract's error format`() {
        val bad = call(
            "POST", "/api/v1/tenants", operator,
            """{"name":" ","slug":"Con Mayúsculas","timeZone":"Marte/Olimpo","weekStartsOn":"lunes","firstAdminEmail":"sin-arroba"}""",
        )
        assertProblem(422, "validation", bad)
        assertEquals(
            setOf("name", "slug", "timeZone", "weekStartsOn", "breakPolicy", "firstAdminEmail"),
            bad.list("errors[*].field").toSet(),
        )

        assertProblem(422, "validation", call("POST", "/api/v1/tenants", operator, tenantBody("con-extra", email("x"), ""","tenantId":"otro"""")))
        assertProblem(422, "validation", call("POST", "/api/v1/tenants", operator, "{no es json"))
        assertProblem(422, "validation", call("POST", "/api/v1/tenants", operator, ""))

        val slug = "repetida-${UUID.randomUUID().toString().take(8)}"
        val firstEmail = email("unica")
        assertEquals(201, call("POST", "/api/v1/tenants", operator, tenantBody(slug, firstEmail)).status)
        assertProblem(409, "slug_taken", call("POST", "/api/v1/tenants", operator, tenantBody(slug, email("otra"))))
        // El correo de quien ya administra otra empresa tampoco sirve, y no queda una empresa a medias.
        val half = "a-medias-${UUID.randomUUID().toString().take(8)}"
        assertProblem(409, "email_unavailable", call("POST", "/api/v1/tenants", operator, tenantBody(half, firstEmail)))
        assertEquals(201, call("POST", "/api/v1/tenants", operator, tenantBody(half, email("libre"))).status)

        val c = company()
        assertProblem(422, "validation", call("PATCH", "/api/v1/tenant", c.adminToken, "{}"))
        assertProblem(422, "validation", call("PATCH", "/api/v1/tenant", c.adminToken, """{"timeZone":"+05:00"}"""))
        assertProblem(422, "validation", call("PATCH", "/api/v1/tenant", c.adminToken, """{"slug":"otro-slug"}"""))
        assertProblem(422, "validation", call("POST", "/api/v1/users", c.adminToken, """{"email":"${email("sin-rol")}","roles":[]}"""))
        assertProblem(422, "validation", call("POST", "/api/v1/users", c.adminToken, """{"email":"${email("operar")}","roles":["operador_saas"]}"""))
        assertProblem(422, "validation", call("PATCH", "/api/v1/users/${c.adminId}", c.adminToken, "{}"))
        assertProblem(422, "validation", call("GET", "/api/v1/users?limit=0", c.adminToken))
        assertProblem(422, "validation", call("GET", "/api/v1/users?cursor=inventado", c.adminToken))
        assertProblem(422, "validation", call("GET", "/api/v1/audit-log?from=ayer", c.adminToken))
        assertProblem(404, "not_found", call("GET", "/api/v1/users/no-es-un-identificador", c.adminToken))
        assertProblem(404, "not_found", call("GET", "/api/v1/users/${UUID.randomUUID()}", c.adminToken))
    }

    @Test
    fun `lists are walked page by page without repeating or skipping`() {
        val c = company()
        val invited = (1..4).map {
            call("POST", "/api/v1/users", c.adminToken, """{"email":"${email("pagina")}","roles":["trabajador"]}""").at<String>("id")
        }

        val first = call("GET", "/api/v1/users?limit=2", c.adminToken)
        assertEquals(2, first.at<Int>("items.length()"))
        val cursor = assertNotNull(first.at<String?>("nextCursor"))
        val second = call("GET", "/api/v1/users?limit=2&cursor=$cursor", c.adminToken)
        val third = call("GET", "/api/v1/users?limit=2&cursor=${second.at<String>("nextCursor")}", c.adminToken)
        assertNull(third.at<String?>("nextCursor"))

        val walked = first.list("items[*].id") + second.list("items[*].id") + third.list("items[*].id")
        assertEquals(listOf(c.adminId) + invited, walked)

        val audit = call("GET", "/api/v1/audit-log?limit=3", c.adminToken)
        assertEquals(3, audit.at<Int>("items.length()"))
        val rest = call("GET", "/api/v1/audit-log?limit=200&cursor=${audit.at<String>("nextCursor")}", c.adminToken)
        // Alta de la empresa, invitación y liga de la administradora, y cuatro invitaciones.
        assertEquals(7, audit.at<Int>("items.length()") + rest.at<Int>("items.length()"))
        assertNull(rest.at<String?>("nextCursor"))
    }
}
