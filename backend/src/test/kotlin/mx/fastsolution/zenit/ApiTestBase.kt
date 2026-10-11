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
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.TestPropertySource
import java.io.ByteArrayOutputStream
import java.net.InetSocketAddress
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.Path
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.interfaces.RSAPublicKey
import java.time.Instant
import java.util.Date
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Recorre el API por HTTP, contra PostgreSQL real y con tokens firmados que el
 * backend valida igual que los del proveedor de identidad: lee las claves de
 * una dirección, comprueba firma, vigencia, emisor y audiencia.
 *
 * Se corre con `docker compose --profile test run --rm backend-it`.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
// Las pruebas usan la tarjeta simulada; CaptureOffIT comprueba que nace apagada.
@TestPropertySource(properties = ["zenit.capture.simulated-cards=true"])
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
abstract class ApiTestBase {
    companion object {
        const val KEY_ID = "prueba"
        const val ISSUER = "http://identidad.invalid/realms/zenit"
        const val OPERATOR = "operadora@zenit.invalid"
        val keys: KeyPair by lazy { rsa() }
        val databaseUrl: String by lazy { System.getenv("IT_DB_URL") ?: error("Falta IT_DB_URL") }

        /** Publica la clave de prueba como lo hace el proveedor de identidad. */
        val jwks: HttpServer by lazy {
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

        fun rsa(): KeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()

        fun secret(name: String): String = Files.readString(Path.of("/run/secrets", name)).trim()

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            // El backend no migra: el esquema se aplica antes, con el rol dueño.
            Flyway.configure()
                .dataSource(databaseUrl, "zenit_migrator", secret("db_migrator_password"))
                .locations("classpath:db/migration")
                .load()
                .migrate()
            registry.add("spring.datasource.url") { databaseUrl }
            registry.add("zenit.identity.issuer") { ISSUER }
            registry.add("zenit.identity.jwks-uri") { "http://127.0.0.1:${jwks.address.port}/certs" }
            registry.add("zenit.operators.emails") { OPERATOR }
        }
    }

    protected val http = HttpClient.newHttpClient()

    @Autowired
    private lateinit var environment: Environment

    /** Puerto del backend bajo prueba: cada configuración levanta su contexto en un puerto propio. */
    protected val serverPort: Int get() = environment.getProperty("local.server.port")!!.toInt()

    protected class Reply(val status: Int, val body: String, val contentType: String) {
        fun <T> at(path: String): T = JsonPath.read(body, "\$.$path")

        fun list(path: String): List<String> = at(path)

        override fun toString() = "$status $body"
    }

    protected fun call(
        method: String,
        path: String,
        token: String? = null,
        body: String? = null,
        headers: Map<String, String> = emptyMap(),
    ): Reply {
        val request = HttpRequest.newBuilder(URI("http://127.0.0.1:$serverPort$path"))
        if (token != null) request.header("Authorization", "Bearer $token")
        if (body != null) request.header("Content-Type", "application/json")
        headers.forEach { (name, value) -> request.header(name, value) }
        request.method(method, body?.let { HttpRequest.BodyPublishers.ofString(it) } ?: HttpRequest.BodyPublishers.noBody())
        val response = http.send(request.build(), HttpResponse.BodyHandlers.ofString())
        return Reply(response.statusCode(), response.body(), response.headers().firstValue("Content-Type").orElse(""))
    }

    /** Sube un archivo como `multipart/form-data`. Con `csv` nulo no manda ningún archivo. */
    protected fun upload(
        path: String,
        token: String?,
        csv: ByteArray?,
        dryRun: String? = null,
        key: String? = UUID.randomUUID().toString(),
    ): Reply {
        val boundary = "zenit-${UUID.randomUUID()}"
        val body = ByteArrayOutputStream()
        fun part(name: String, extra: String, content: ByteArray) {
            body.write("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"$extra\r\n\r\n".toByteArray())
            body.write(content)
            body.write("\r\n".toByteArray())
        }
        if (csv != null) part("file", "; filename=\"padron.csv\"\r\nContent-Type: text/csv", csv)
        if (dryRun != null) part("dryRun", "", dryRun.toByteArray())
        body.write("--$boundary--\r\n".toByteArray())
        val request = HttpRequest.newBuilder(URI("http://127.0.0.1:$serverPort$path"))
            .header("Content-Type", "multipart/form-data; boundary=$boundary")
        if (token != null) request.header("Authorization", "Bearer $token")
        if (key != null) request.header("Idempotency-Key", key)
        request.POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
        val response = http.send(request.build(), HttpResponse.BodyHandlers.ofString())
        return Reply(response.statusCode(), response.body(), response.headers().firstValue("Content-Type").orElse(""))
    }

    protected fun token(
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

    protected fun subject() = UUID.randomUUID().toString()

    protected fun email(prefix: String) = "$prefix-${UUID.randomUUID().toString().take(8)}@zenit.invalid"

    protected val operator: String get() = token("11111111-1111-4111-8111-111111111111", OPERATOR)

    protected fun tenantBody(slug: String, adminEmail: String, extra: String = "") =
        """{"name":"Empresa $slug","slug":"$slug","timeZone":"America/Mexico_City","weekStartsOn":"monday",""" +
            """"breakPolicy":"not_considered","firstAdminEmail":"$adminEmail"$extra}"""

    protected class Company(val id: String, val adminEmail: String, val adminToken: String, val adminId: String)

    /** Empresa nueva, con su primera administradora ya ligada. */
    protected fun company(): Company {
        val slug = "empresa-${UUID.randomUUID().toString().take(8)}"
        val adminEmail = email("admin")
        val created = call("POST", "/api/v1/tenants", operator, tenantBody(slug, adminEmail))
        assertEquals(201, created.status, created.toString())
        val adminToken = token(subject(), adminEmail)
        val me = call("GET", "/api/v1/me", adminToken)
        assertEquals(200, me.status, me.toString())
        return Company(created.at("id"), adminEmail, adminToken, me.at("userId"))
    }

    protected class Member(val id: String, val email: String, val token: String)

    /** Persona invitada a la empresa, que ya entró por primera vez. */
    protected fun member(company: Company, vararg roles: String): Member {
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

    protected fun assertProblem(expectedStatus: Int, expectedCode: String, reply: Reply) {
        assertEquals(expectedStatus, reply.status, reply.toString())
        assertTrue(reply.contentType.startsWith("application/problem+json"), reply.contentType)
        assertEquals(expectedCode, reply.at("code"))
        assertEquals(expectedStatus, reply.at("status"))
        UUID.fromString(reply.at("correlationId"))
    }
}
