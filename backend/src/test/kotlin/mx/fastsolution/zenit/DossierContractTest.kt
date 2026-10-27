package mx.fastsolution.zenit

import com.networknt.schema.ExecutionContext
import com.networknt.schema.InputFormat
import com.networknt.schema.SchemaLocation
import com.networknt.schema.SchemaRegistry
import com.networknt.schema.dialect.Dialects
import tools.jackson.databind.JsonNode
import tools.jackson.databind.node.ObjectNode
import tools.jackson.dataformat.yaml.YAMLMapper
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets.UTF_8
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.time.ZoneId
import java.util.Base64
import java.util.function.Consumer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** E1 valida el diseño y sus fixtures; no simula endpoints aún inexistentes. */
class DossierContractTest {
    private val directory = Path.of(System.getProperty("zenit.contractsDirectory"))
    private val base = "https://zenit.invalid/contrato/"
    private val mapper = YAMLMapper()
    private val documents = listOf("openapi.yaml", "dossier.openapi.yaml", "dossier-format.schema.yaml")
        .associateWith { Files.readString(directory.resolve(it)) }
    private val api = mapper.readTree(documents.getValue("dossier.openapi.yaml"))
    private val format = mapper.readTree(documents.getValue("dossier-format.schema.yaml"))
    private val registry = SchemaRegistry.withDialects(listOf(Dialects.getOpenApi31(), Dialects.getDraft202012())) {
        it.schemas(documents.mapKeys { (name, _) -> base + name })
    }
    private val manifest = mapper.readTree(Files.readString(directory.resolve("examples/dossier-v1/manifest.json")))
    private val operations = api.get("paths").properties().flatMap { (path, item) ->
        listOf("get", "put", "post").mapNotNull { method -> item.get(method)?.let { Triple(path, method, it) } }
    }

    private fun errors(document: String, pointer: String, value: JsonNode) =
        registry.getSchema(SchemaLocation.of("$base$document#${pointer.replace("{", "%7B").replace("}", "%7D")}")).validate(
            value.toString(), InputFormat.JSON,
            Consumer<ExecutionContext> { context -> context.executionConfig { it.formatAssertionsEnabled(true) } },
        )

    private fun valid(document: String, pointer: String, value: JsonNode) {
        assertEquals(emptyList(), errors(document, pointer, value), "$document#$pointer: $value")
    }

    private fun invalid(document: String, pointer: String, value: JsonNode) {
        assertTrue(errors(document, pointer, value).isNotEmpty(), "Debía rechazar $document#$pointer: $value")
    }

    private fun changed(node: JsonNode, edit: (ObjectNode) -> Unit): JsonNode =
        (mapper.readTree(node.toString()) as ObjectNode).also(edit)

    private fun example(path: String, method: String, status: String): JsonNode =
        api.get("paths").get(path).get(method).get("responses").get(status)
            .get("content").get("application/json").get("example")

    private fun escape(value: String) = value.replace("~", "~0").replace("/", "~1")

    @Test
    fun `all inline and external examples match their schemas including existing error references`() {
        var checked = 0
        fun visit(node: JsonNode, pointer: String) {
            if (node.isObject) {
                if (node.has("schema")) {
                    node.get("example")?.let {
                        valid("dossier.openapi.yaml", "$pointer/schema", it)
                        checked++
                    }
                    node.get("examples")?.properties()?.forEach { (_, entry) ->
                        val relative = entry.get("externalValue").asString().removePrefix("./")
                        valid("dossier.openapi.yaml", "$pointer/schema", mapper.readTree(Files.readString(directory.resolve(relative))))
                        checked++
                    }
                }
                node.properties().forEach { (key, child) -> visit(child, "$pointer/${escape(key)}") }
            }
        }
        visit(api, "")
        assertTrue(checked >= 15, "No se recorrieron los ejemplos: $checked")
    }

    @Test
    fun `E2 E3 publish only implemented routes and preserve CSV permissions`() {
        val live = mapper.readTree(documents.getValue("openapi.yaml"))
        assertEquals("0.14.0", live.at("/info/version").asString())
        assertEquals("partial", api.get("x-implementation").asString())
        assertEquals(8, operations.size)
        assertEquals(8, operations.map { it.third.get("operationId").asString() }.toSet().size)
        for ((path, _, operation) in operations) {
            val implemented = !path.endsWith("/challenges") && !path.endsWith("/authorizations") && !path.endsWith("/download")
            assertEquals(implemented, live.get("paths").has(path), path)
            if (implemented) assertEquals(operation.get("operationId"), live.get("paths").get(path).get(operations.first { it.first == path }.second).get("operationId"))
            val roles = operation.get("x-roles").asSequence().map { it.asString() }.toSet()
            assertFalse("operador_saas" in roles || "conector" in roles)
            assertEquals("userToken", api.get("security")[0].propertyNames().single())
            if (path.startsWith("/dossiers")) {
                assertEquals(listOf("dossier_download"), operation.get("x-permissions").asSequence().map { it.asString() }.toList())
                assertTrue(operation.get("responses").has("403"))
            }
        }
        assertEquals(listOf("admin_empresa"), api.get("paths").get("/users/{userId}/dossier-permission").get("put").get("x-roles").asSequence().map { it.asString() }.toList())
        val csv = live.get("paths").get("/exports/{exportId}/download").get("get")
        assertEquals(listOf("admin_empresa", "rh", "auditor"), csv.get("x-roles").asSequence().map { it.asString() }.toList())
        assertFalse(csv.has("x-permissions"))
    }

    @Test
    fun `requests reject tenant owner scope URL and JWT injection and require strong PKCE shapes`() {
        fun check(name: String, json: String, allowed: Boolean) {
            val value = mapper.readTree(json)
            if (allowed) valid("dossier.openapi.yaml", "/components/schemas/$name", value)
            else invalid("dossier.openapi.yaml", "/components/schemas/$name", value)
        }
        check("DossierCreate", """{"formatVersion":1}""", true)
        for (extra in listOf("tenantId", "requestedBy", "scope", "siteId", "from", "downloadUrl")) {
            check("DossierCreate", """{"formatVersion":1,"$extra":"ajeno"}""", false)
        }
        check("DossierCreate", """{"formatVersion":2}""", false)
        check("DossierPermission", """{"enabled":"true"}""", false)
        check("ChallengeCreate", """{"codeChallenge":"corto"}""", false)
        val request = api.get("paths").get("/dossiers/{dossierId}/authorizations").get("post")
            .get("requestBody").get("content").get("application/json").get("example")
        valid("dossier.openapi.yaml", "/components/schemas/AuthorizationCreate", request)
        for (field in listOf("challengeId", "state", "codeVerifier", "code")) {
            invalid("dossier.openapi.yaml", "/components/schemas/AuthorizationCreate", changed(request) { it.remove(field) })
        }
        invalid("dossier.openapi.yaml", "/components/schemas/AuthorizationCreate", changed(request) { it.put("idToken", "JWT-no-acredita-operacion") })
        invalid("dossier.openapi.yaml", "/components/schemas/AuthorizationCreate", changed(request) { it.put("codeVerifier", "corto") })
        val challenge = example("/dossiers/{dossierId}/challenges", "post", "201")
        invalid("dossier.openapi.yaml", "/components/schemas/Challenge", changed(challenge) { it.put("authorizationUrl", "http://identity.example.invalid/") })
        check("DownloadRequest", """{"authorization":"corto"}""", false)
    }

    @Test
    fun `OIDC examples correlate state and the actual S256 verifier without bearer tokens in URLs`() {
        val challenge = example("/dossiers/{dossierId}/challenges", "post", "201")
        val proof = api.get("paths").get("/dossiers/{dossierId}/authorizations").get("post")
            .get("requestBody").get("content").get("application/json").get("example")
        val url = URI.create(challenge.get("authorizationUrl").asString())
        val query = url.rawQuery.split('&').associate {
            val pair = it.split('=', limit = 2)
            pair[0] to URLDecoder.decode(pair[1], UTF_8)
        }
        assertEquals("https", url.scheme)
        assertEquals("code", query["response_type"])
        assertEquals("S256", query["code_challenge_method"])
        assertEquals("2", query["acr_values"])
        assertEquals(challenge.get("state").asString(), query["state"])
        assertEquals(proof.get("state").asString(), query["state"])
        assertEquals(challenge.get("id"), proof.get("challengeId"))
        val hash = MessageDigest.getInstance("SHA-256").digest(proof.get("codeVerifier").asString().toByteArray(UTF_8))
        assertEquals(Base64.getUrlEncoder().withoutPadding().encodeToString(hash), query["code_challenge"])
        assertTrue(query["nonce"]!!.matches(Regex("[A-Za-z0-9_-]{43}")))
        assertFalse(query.keys.any { it in setOf("authorization", "access_token", "id_token", "refresh_token", "code_verifier") })
    }

    @Test
    fun `ready needs a snapshot and both hashes and failed cannot claim a usable file`() {
        val ready = example("/dossiers/{dossierId}", "get", "200")
        val queued = example("/dossiers", "post", "202")
        val pointer = "/components/schemas/Dossier"
        valid("dossier.openapi.yaml", pointer, ready)
        valid("dossier.openapi.yaml", pointer, changed(ready) { it.put("status", "downloaded") })
        valid("dossier.openapi.yaml", pointer, changed(ready) { it.put("status", "expired") })
        valid("dossier.openapi.yaml", pointer, changed(queued) { it.put("status", "preparing"); it.put("snapshotAt", "2026-10-26T12:00:01Z") })
        valid("dossier.openapi.yaml", pointer, changed(queued) { it.put("status", "failed"); it.put("failureCode", "preparation_failed") })
        for (field in listOf("snapshotAt", "readyAt", "manifestSha256", "fileSha256")) {
            invalid("dossier.openapi.yaml", pointer, changed(ready) { it.putNull(field) })
        }
        invalid("dossier.openapi.yaml", pointer, changed(ready) { it.put("status", "failed"); it.put("failureCode", "preparation_failed") })
        invalid("dossier.openapi.yaml", pointer, changed(ready) { it.put("status", "desconocido") })
        invalid("dossier.openapi.yaml", pointer, changed(ready) { it.put("id", "no-uuid") })
        invalid("dossier.openapi.yaml", pointer, changed(ready) { it.put("fileSha256", "alterado") })
        invalid("dossier.openapi.yaml", pointer, changed(ready) { it.put("status", "expired"); it.putNull("manifestSha256") })
    }

    @Test
    fun `manifest rejects traversal duplicate files missing counts bad hashes and invented evidence`() {
        val doc = "dossier-format.schema.yaml"
        val pointer = "/\$defs/Manifest"
        valid(doc, pointer, manifest)
        invalid(doc, pointer, changed(manifest) { (it.get("files")[0] as ObjectNode).put("path", "../secrets") })
        invalid(doc, pointer, changed(manifest) { (it.get("files")[1] as ObjectNode).put("path", "records.ndjson") })
        invalid(doc, pointer, changed(manifest) { (it.get("files")[0] as ObjectNode).put("sha256", "0") })
        invalid(doc, pointer, changed(manifest) { (it.get("counts") as ObjectNode).remove("attendance_rejection") })
        invalid(doc, pointer, changed(manifest) { (it.get("counts") as ObjectNode).put("employee", -1) })
        invalid(doc, pointer, changed(manifest) { it.putArray("limitations").add("rechazos_originales_reconstruidos") })
        invalid(doc, pointer, changed(manifest) { it.put("tenantId", "otro") })
    }

    @Test
    fun `archive records have a closed field list and reject private keys and identity secrets`() {
        val records = Files.readAllLines(directory.resolve("examples/dossier-v1/records.ndjson")).map { mapper.readTree(it) }
        for (record in records) {
            valid("dossier-format.schema.yaml", "/\$defs/Record", record)
            invalid("dossier-format.schema.yaml", "/\$defs/Record", changed(record) { (it.get("data") as ObjectNode).put("password", "prohibida") })
        }
        for ((name, definition) in format.get("\$defs").properties()) {
            if (!definition.at("/properties/kind").isMissingNode) {
                val payload = definition.at("/properties/data")
                assertFalse(payload.get("additionalProperties").asBoolean(), name)
                assertEquals(payload.get("properties").propertyNames().toSet(), payload.get("required").asSequence().map { it.asString() }.toSet(), name)
                for (secret in listOf("password", "subject", "email", "otp_secret", "refresh_token", "private_key", "code_sha256")) {
                    assertFalse(payload.get("properties").has(secret), "$name incluye $secret")
                }
            }
        }
        val jwk = mapper.readTree("""{"kty":"EC","crv":"P-256","x":"${"A".repeat(43)}","y":"${"A".repeat(43)}"}""")
        valid("dossier-format.schema.yaml", "/\$defs/PublicJwk", jwk)
        invalid("dossier-format.schema.yaml", "/\$defs/PublicJwk", changed(jwk) { it.put("d", "clave-privada") })
        invalid("dossier-format.schema.yaml", "/\$defs/Metadata", mapper.readTree("""{"token":"prohibido"}"""))
    }

    @Test
    fun `fixture inventory hashes counts and company references agree with exact bytes`() {
        val fixture = directory.resolve("examples/dossier-v1")
        val inventory = manifest.get("files").asSequence().map { it.get("path").asString() }.toSet() + "manifest.json"
        Files.list(fixture).use { assertEquals(inventory, it.map { path -> path.fileName.toString() }.toList().toSet()) }
        for (name in inventory) {
            val bytes = Files.readAllBytes(fixture.resolve(name))
            assertTrue(bytes.last() == 10.toByte(), "$name debe terminar con LF")
            assertFalse(13.toByte() in bytes, "$name no debe contener CR")
            assertFalse(bytes.take(3) == listOf(0xef.toByte(), 0xbb.toByte(), 0xbf.toByte()), "$name sin BOM")
        }
        for (file in manifest.get("files")) {
            val bytes = Files.readAllBytes(fixture.resolve(file.get("path").asString()))
            assertEquals(file.get("bytes").asLong(), bytes.size.toLong())
            val digest = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            assertEquals(file.get("sha256").asString(), digest)
        }
        val rows = Files.readAllLines(fixture.resolve("records.ndjson")).map { mapper.readTree(it) }
        for ((kind, count) in manifest.get("counts").properties()) {
            assertEquals(count.asInt(), rows.count { it.get("kind").asString() == kind }, kind)
        }
        assertTrue(rows.all { it.get("tenantId") == manifest.get("tenantId") })
        assertEquals(manifest.get("tenantId"), rows.single { it.get("kind").asString() == "tenant" }.at("/data/id"))
        assertEquals(manifest.get("requestedBy"), rows.single { it.get("kind").asString() == "tenant_user" }.at("/data/id"))
        assertEquals(23, manifest.get("counts").size())
        ZoneId.of(manifest.get("timeZone").asString())
    }
}
