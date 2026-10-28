package mx.fastsolution.zenit

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.sun.net.httpserver.HttpServer
import mx.fastsolution.zenit.export.sha256
import org.junit.jupiter.api.Tag
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets.UTF_8
import java.sql.DriverManager
import java.time.Instant
import java.util.Date
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.*

/** OIDC por HTTP y JWT realmente firmado; permisos, transacciones y ZIP usan PostgreSQL real. */
@Tag("integration")
class DossierVerificationIT : WorkdayTestBase() {
    companion object {
        data class Proof(val nonce: String, val subject: String, val verifier: String, val changes: Map<String, Any> = emptyMap())
        private val proofs = ConcurrentHashMap<String, Proof>()
        private val provider = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/token") { exchange ->
                val params = exchange.requestBody.readAllBytes().toString(UTF_8).split('&').associate { val pair = it.split('=', limit = 2); URLDecoder.decode(pair[0], UTF_8) to URLDecoder.decode(pair.getOrElse(1) { "" }, UTF_8) }
                val proof = proofs.remove(params["code"])
                var status = 400
                var body = "{\"error\":\"invalid_grant\"}"
                if (proof != null && params["grant_type"] == "authorization_code" && params["client_id"] == "zenit-dossier" && params["redirect_uri"] == "http://localhost:8081/dossier/callback" && params["code_verifier"] == proof.verifier) {
                    if (proof.changes["network"] == true) { status = 503; body = "{}" }
                    else {
                        val now = Instant.now()
                        val claims = JWTClaimsSet.Builder().subject(proof.changes["subject"] as? String ?: proof.subject)
                            .issuer(proof.changes["issuer"] as? String ?: ISSUER).audience(proof.changes["audience"] as? String ?: "zenit-dossier")
                            .issueTime(Date.from(now.plusSeconds((proof.changes["iat"] as? Long) ?: 0)))
                            .expirationTime(Date.from(now.plusSeconds((proof.changes["exp"] as? Long) ?: 120)))
                            .claim("acr", proof.changes["acr"] ?: "2").claim("nonce", proof.changes["nonce"] ?: proof.nonce)
                            .claim("azp", proof.changes["azp"] ?: "zenit-dossier").build()
                        val signed = SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KEY_ID).build(), claims)
                        signed.sign(RSASSASigner(if (proof.changes["signature"] == false) rsa().private else keys.private))
                        status = 200; body = "{\"id_token\":\"${signed.serialize()}\"}"
                    }
                }
                val bytes = body.toByteArray(UTF_8)
                exchange.responseHeaders.add("Content-Type", "application/json")
                exchange.sendResponseHeaders(status, bytes.size.toLong()); exchange.responseBody.use { it.write(bytes) }
            }
            start()
        }
        @JvmStatic @DynamicPropertySource
        fun oidc(registry: DynamicPropertyRegistry) { registry.add("zenit.dossier.token-uri") { "http://127.0.0.1:${provider.address.port}/token" } }
    }

    private fun setup(): Pair<Company, String> {
        val c = company()
        assertEquals(200, grant(c, c.adminId, true).status)
        return c to ready(c)
    }
    private fun grant(c: Company, user: String, enabled: Boolean) = call("PUT", "/api/v1/users/$user/dossier-permission", c.adminToken, """{"enabled":$enabled}""")
    private fun ready(c: Company): String {
        val asked = call("POST", "/api/v1/dossiers", c.adminToken, """{"formatVersion":1}""", mapOf("Idempotency-Key" to UUID.randomUUID().toString()))
        assertEquals(202, asked.status, asked.toString()); jobWorker.drain(100)
        assertEquals("ready", call("GET", "/api/v1/dossiers/${asked.at<String>("id")}", c.adminToken).at("status"))
        return asked.at("id")
    }
    private data class Challenge(val id: String, val state: String, val nonce: String, val verifier: String)
    private fun challenge(c: Company, id: String, token: String = c.adminToken): Challenge {
        val verifier = UUID.randomUUID().toString().replace("-", "") + "A".repeat(11)
        val pkce = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        val reply = call("POST", "/api/v1/dossiers/$id/challenges", token, json(mapOf("codeChallenge" to pkce)))
        assertEquals(201, reply.status, reply.toString()); assertEquals("no-store", reply.header("Cache-Control"))
        val uri = URI(reply.at<String>("authorizationUrl"))
        val params = uri.rawQuery.split('&').associate { val pair = it.split('=', limit = 2); URLDecoder.decode(pair[0], UTF_8) to URLDecoder.decode(pair[1], UTF_8) }
        assertEquals(ISSUER + "/protocol/openid-connect/auth", uri.toString().substringBefore('?'))
        assertEquals("zenit-dossier", params["client_id"]); assertEquals("S256", params["code_challenge_method"]); assertEquals("2", params["acr_values"])
        assertEquals(pkce, params["code_challenge"]); assertEquals(reply.at<String>("state"), params["state"])
        assertTrue(params.getValue("nonce").matches(Regex("^[A-Za-z0-9_-]{43}$")))
        return Challenge(reply.at("id"), reply.at("state"), params.getValue("nonce"), verifier)
    }
    private fun authorize(c: Company, id: String, challenge: Challenge, changes: Map<String, Any> = emptyMap(), state: String = challenge.state, verifier: String = challenge.verifier): Reply {
        val code = UUID.randomUUID().toString()
        val subject = com.nimbusds.jwt.SignedJWT.parse(c.adminToken).jwtClaimsSet.subject
        proofs[code] = Proof(challenge.nonce, subject, challenge.verifier, changes)
        return call("POST", "/api/v1/dossiers/$id/authorizations", c.adminToken, json(mapOf("challengeId" to challenge.id, "state" to state, "codeVerifier" to verifier, "code" to code)))
    }
    private fun download(c: Company, id: String, authorization: String, headers: Map<String, String> = emptyMap()): HttpResponse<ByteArray> {
        val body = json(mapOf("authorization" to authorization))
        val request = HttpRequest.newBuilder(URI("http://127.0.0.1:$serverPort/api/v1/dossiers/$id/download"))
            .header("Authorization", "Bearer ${c.adminToken}").header("Content-Type", "application/json")
        headers.forEach { (key, value) -> request.header(key, value) }
        val response = http.send(request.POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofByteArray())
        ContractCheck.verify("POST", "/api/v1/dossiers/$id/download", response.statusCode(), response.headers().firstValue("Content-Type").orElse(""), response.body().toString(UTF_8), body)
        return response
    }
    private fun problem(response: HttpResponse<ByteArray>, status: Int, code: String) = assertProblem(status, code, Reply(response.statusCode(), response.body().toString(UTF_8), response.headers().firstValue("Content-Type").orElse("")))
    private fun time(statement: String, vararg values: String) {
        DriverManager.getConnection(databaseUrl, "zenit_migrator", secret("db_migrator_password")).use { db -> db.prepareStatement(statement).use { s -> values.forEachIndexed { i, value -> s.setObject(i+1, UUID.fromString(value)) }; s.executeUpdate() } }
    }

    @Test
    fun `story fresh OIDC verification authorizes one intact download and keeps the original manifest`() {
        val (c, id) = setup()
        val challenge = challenge(c, id)
        val authorization = authorize(c, id, challenge)
        assertEquals(201, authorization.status, authorization.toString())
        assertEquals("no-store", authorization.header("Cache-Control"))
        val token = authorization.at<String>("authorization")
        assertTrue(token.matches(Regex("[A-Za-z0-9_-]{43}")))
        assertEquals(1, count("select count(*) from dossier_authorization where tenant_id=? and authorization_sha256=?", UUID.fromString(c.id), sha256(token.toByteArray())))
        assertProblem(409, "challenge_consumed", authorize(c, id, challenge))
        val before = call("GET", "/api/v1/dossiers/$id", c.adminToken)
        val manifest = call("GET", "/api/v1/dossiers/$id/manifest", c.adminToken).body
        problem(download(c, id, token, mapOf("Range" to "bytes=0-10")), 422, "validation")
        val file = download(c, id, token)
        assertEquals(200, file.statusCode(), file.body().toString(UTF_8))
        assertEquals("application/zip", file.headers().firstValue("Content-Type").orElse(""))
        assertEquals("no-store", file.headers().firstValue("Cache-Control").orElse(""))
        assertEquals(before.at<String>("fileSha256"), sha256(file.body()))
        val offline = java.nio.file.Files.createTempFile("dossier-downloaded-", ".zip")
        try {
            java.nio.file.Files.write(offline, file.body())
            val verified = mx.fastsolution.zenit.dossier.DossierVerifier().verify(offline, before.at("manifestSha256"), before.at("fileSha256"))
            assertEquals(c.id, verified.get("tenantId").asString())
        } finally { java.nio.file.Files.deleteIfExists(offline) }
        assertEquals("attachment; filename=\"expediente-$id.zip\"", file.headers().firstValue("Content-Disposition").orElse(""))
        assertEquals("downloaded", call("GET", "/api/v1/dossiers/$id", c.adminToken).at("status"))
        assertEquals(manifest, call("GET", "/api/v1/dossiers/$id/manifest", c.adminToken).body)
        problem(download(c, id, token), 410, "dossier_downloaded")
        jobWorker.tick()
        assertEquals(0, count("select count(*) from dossier_chunk where dossier_id=?", UUID.fromString(id)))
        for (action in listOf("dossier.challenge_created", "dossier.authorized", "dossier.downloaded")) assertEquals(1, count("select count(*) from audit_log where target_id=? and action=?", id, action))
    }

    @Test
    fun `invalid state PKCE signature issuer audience subject nonce time and level cannot authorize`() {
        val (c, id) = setup()
        for (changes in listOf(mapOf("signature" to false), mapOf("issuer" to "https://foreign.invalid"), mapOf("audience" to "zenit-api"), mapOf("subject" to "other"), mapOf("nonce" to "reused"), mapOf("acr" to "1"), mapOf("exp" to -1L), mapOf("iat" to -3600L), mapOf("iat" to 3600L), mapOf("azp" to "other-client"))) {
            val challenge = challenge(c, id)
            assertProblem(403, "verification_failed", authorize(c, id, challenge, changes))
            assertProblem(409, "challenge_consumed", authorize(c, id, challenge))
        }
        assertProblem(403, "verification_failed", authorize(c, id, challenge(c, id), state = "X".repeat(43)))
        assertProblem(403, "verification_failed", authorize(c, id, challenge(c, id), verifier = "Z".repeat(43)))
        assertEquals(0, count("select count(*) from dossier_authorization where dossier_id=?", UUID.fromString(id)))
        val challenge = challenge(c, id)
        assertProblem(503, "identity_unavailable", authorize(c, id, challenge, mapOf("network" to true)))
        assertProblem(409, "challenge_consumed", authorize(c, id, challenge))
        assertProblem(422, "validation", call("POST", "/api/v1/dossiers/$id/authorizations", c.adminToken, json(mapOf("challengeId" to challenge.id,"state" to challenge.state,"codeVerifier" to challenge.verifier,"code" to "jwt","idToken" to "not-an-operation-proof"))))
    }

    @Test
    fun `new challenge revocation and account or tenant suspension invalidate earlier proof permanently`() {
        val (c, id) = setup()
        var first = challenge(c, id)
        var issued = authorize(c, id, first).at<String>("authorization")
        challenge(c, id)
        problem(download(c, id, issued), 410, "authorization_expired")
        assertProblem(410, "challenge_expired", authorize(c, id, first))
        first = challenge(c, id)
        assertEquals(200, grant(c, c.adminId, false).status)
        assertProblem(403, "forbidden", authorize(c, id, first))
        assertEquals(200, grant(c, c.adminId, true).status)
        assertProblem(410, "challenge_expired", authorize(c, id, first))
        first = challenge(c, id); issued = authorize(c, id, first).at("authorization")
        change("update tenant_user set status='disabled' where tenant_id=? and id=?", UUID.fromString(c.id), UUID.fromString(c.adminId))
        problem(download(c, id, issued), 403, "forbidden")
        change("update tenant_user set status='active' where tenant_id=? and id=?", UUID.fromString(c.id), UUID.fromString(c.adminId))
        problem(download(c, id, issued), 410, "authorization_expired")
        first = challenge(c, id)
        change("update tenant set status='suspended' where id=?", UUID.fromString(c.id))
        change("update tenant set status='active' where id=?", UUID.fromString(c.id))
        assertProblem(410, "challenge_expired", authorize(c, id, first))
    }

    @Test
    fun `expired challenges and authorizations and foreign dossiers are rejected without leaking existence`() {
        val (c, id) = setup()
        val other = company(); assertEquals(200, grant(other, other.adminId, true).status)
        assertProblem(404, "not_found", call("POST", "/api/v1/dossiers/$id/challenges", other.adminToken, json(mapOf("codeChallenge" to "A".repeat(43)))))
        val colleague = member(c, "auditor"); assertEquals(200, grant(c,colleague.id,true).status)
        assertProblem(404, "not_found", call("POST", "/api/v1/dossiers/$id/challenges", colleague.token, json(mapOf("codeChallenge" to "A".repeat(43)))))
        val second = ready(c)
        val first = challenge(c, id)
        assertProblem(404, "not_found", authorize(c, second, first))
        time("update dossier_challenge set expires_at=clock_timestamp() where id=?", first.id)
        assertProblem(410, "challenge_expired", authorize(c, id, first))
        val issued = authorize(c,id,challenge(c,id)).at<String>("authorization")
        time("update dossier_authorization set expires_at=clock_timestamp() where dossier_id=?",id)
        problem(download(c,id,issued),410,"authorization_expired")
        problem(download(c,id,"Y".repeat(43)),403,"verification_failed")
    }

    @Test
    fun `concurrent exchanges and downloads consume their proof at most once`() {
        val (c, id) = setup()
        val challenge = challenge(c,id)
        Executors.newFixedThreadPool(2).use { pool ->
            val replies=(1..2).map { pool.submit<Reply> { authorize(c,id,challenge) } }.map { it.get(20,TimeUnit.SECONDS) }
            assertEquals(listOf(201,409),replies.map { it.status }.sorted())
            val issued=replies.single { it.status==201 }.at<String>("authorization")
            val files=(1..2).map { pool.submit<HttpResponse<ByteArray>> { download(c,id,issued) } }.map { it.get(20,TimeUnit.SECONDS) }
            assertEquals(listOf(200,410),files.map { it.statusCode() }.sorted())
        }
    }
}
