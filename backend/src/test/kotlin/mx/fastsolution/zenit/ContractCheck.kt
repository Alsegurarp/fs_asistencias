package mx.fastsolution.zenit

import com.networknt.schema.Error
import com.networknt.schema.ExecutionContext
import com.networknt.schema.InputFormat
import com.networknt.schema.Schema
import com.networknt.schema.SchemaLocation
import com.networknt.schema.SchemaRegistry
import com.networknt.schema.dialect.Dialects
import tools.jackson.databind.JsonNode
import tools.jackson.dataformat.yaml.YAMLMapper
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.function.Consumer

/**
 * Comprueba que lo que el backend responde cumple lo que el contrato publica.
 * Cada respuesta de las pruebas de integración pasa por aquí: el estado tiene
 * que estar descrito para esa operación y el cuerpo tiene que cumplir su
 * esquema, formatos incluidos.
 */
object ContractCheck {
    private const val DOCUMENT = "https://zenit.invalid/contrato/openapi.yaml"
    private const val BASE = "/api/v1"
    private const val PROBLEM = "/components/schemas/Problem"
    private val JSON_TYPES = setOf("application/json", "application/problem+json")
    private val METHODS = listOf("get", "post", "put", "patch", "delete")

    // El contrato dice en sus convenciones que cualquier operación puede dar estas
    // respuestas aunque no las liste. Aun así su cuerpo debe tener la forma común del error.
    private val CONVENTIONAL = setOf(401, 403, 404, 422, 429)

    private val text: String by lazy { Files.readString(Path.of(System.getProperty("zenit.contract") ?: error("Falta zenit.contract"))) }
    private val root: JsonNode by lazy { YAMLMapper().readTree(text) }
    private val registry: SchemaRegistry by lazy {
        SchemaRegistry.withDialect(Dialects.getOpenApi31()) { it.schemas(mapOf(DOCUMENT to text)) }
    }
    private val schemas = ConcurrentHashMap<String, Schema>()

    /** Cuántas respuestas se han comprobado, y qué operaciones respondieron bien al menos una vez. */
    val checked = AtomicInteger()
    val answeredOk: MutableSet<String> = ConcurrentHashMap.newKeySet()

    /** Cuántos cuerpos de petición aceptados se han comprobado. */
    val requestsChecked = AtomicInteger()

    private class Operation(val method: String, val template: String, val pattern: Regex, val pointer: String, val node: JsonNode)

    private val operations: List<Operation> by lazy {
        buildList {
            for ((path, item) in root.get("paths").properties()) {
                for (method in METHODS) {
                    val node = item.get(method) ?: continue
                    val pattern = Regex("^" + path.split(Regex("\\{[^}]+}")).joinToString("[^/]+") { Regex.escape(it) } + "$")
                    add(Operation(method.uppercase(), path, pattern, "/paths/${escape(path)}/$method", node))
                }
            }
            // Una ruta literal gana a una con parámetros.
        }.sortedBy { it.template.count { c -> c == '{' } }
    }

    /** Operaciones que el contrato describe, como «GET /ruta». */
    fun described(): Set<String> = operations.map { "${it.method} ${it.template}" }.toSet()

    fun verify(method: String, rawPath: String, status: Int, contentType: String, body: String, requestBody: String? = null) {
        val path = rawPath.substringBefore('?')
        if (!path.startsWith("$BASE/")) return
        val relative = path.removePrefix(BASE)
        // Una ruta que el contrato no describe la usan las pruebas para comprobar que está cerrada.
        val operation = operations.firstOrNull { it.method == method && it.pattern.matches(relative) } ?: return
        val mediaType = contentType.substringBefore(';').trim().lowercase()
        checked.incrementAndGet()
        if (status in 200..299) {
            answeredOk += "${operation.method} ${operation.template}"
            // Lo que se aceptó también se compara: el cuerpo de la petición contra su esquema.
            if (!requestBody.isNullOrEmpty()) checkRequest(operation, requestBody)
        }

        var pointer = "${operation.pointer}/responses/$status"
        var response = operation.node.get("responses").get(status.toString())
        if (response == null) {
            if (status !in CONVENTIONAL) fail(operation, status, "el contrato no describe ese estado para esta operación")
            if (mediaType != "application/problem+json") fail(operation, status, "un error debe ir como application/problem+json y llegó $mediaType")
            check(operation, status, PROBLEM, body)
            return
        }
        response.get("\$ref")?.let {
            pointer = it.asString().removePrefix("#")
            response = root.at(pointer)
        }
        val content = response!!.get("content")
        if (content == null) {
            if (body.isNotEmpty()) fail(operation, status, "el contrato no describe cuerpo y la respuesta trae uno")
            return
        }
        val media = content.get(mediaType)
            ?: fail(operation, status, "el contrato no describe el tipo $mediaType; describe ${content.propertyNames()}")
        if (mediaType !in JSON_TYPES) return
        val schema = media.get("schema") ?: return
        // Casi todos los cuerpos apuntan a un esquema con nombre; se valida contra él.
        val target = schema.get("\$ref")?.asString()?.removePrefix("#") ?: "$pointer/content/${escape(mediaType)}/schema"
        check(operation, status, target, body)
    }

    /**
     * Lo que el backend aceptó tiene que ser un cuerpo que el contrato admite.
     * Si acepta algo que el contrato no describe, un cliente generado del
     * contrato no podría mandarlo y nadie sabría que existe.
     */
    private fun checkRequest(operation: Operation, body: String) {
        val media = operation.node.get("requestBody")?.get("content")?.get("application/json") ?: return
        val schema = media.get("schema") ?: return
        val target = schema.get("\$ref")?.asString()?.removePrefix("#") ?: "${operation.pointer}/requestBody/content/${escape("application/json")}/schema"
        requestsChecked.incrementAndGet()
        val errors = violations(target, body)
        if (errors.isNotEmpty()) {
            throw AssertionError("${operation.method} ${operation.template} aceptó un cuerpo que el contrato no admite: $errors. Cuerpo: $body")
        }
    }

    private fun check(operation: Operation, status: Int, pointer: String, body: String) {
        val errors = violations(pointer, body)
        if (errors.isNotEmpty()) fail(operation, status, errors)
    }

    /** Lo que ese cuerpo incumple del esquema; vacío si lo cumple. */
    private fun violations(pointer: String, body: String): String {
        val schema = schemas.computeIfAbsent(pointer) {
            registry.getSchema(SchemaLocation.of("$DOCUMENT#" + it.replace("{", "%7B").replace("}", "%7D")))
        }
        val errors: List<Error> = schema.validate(
            body, InputFormat.JSON,
            Consumer<ExecutionContext> { context -> context.executionConfig { it.formatAssertionsEnabled(true) } },
        )
        // El validador sólo da por bueno un correo cuyo dominio está registrado, y los datos
        // ficticios usan a propósito el dominio reservado «.invalid»: ese formato no se exige.
        val real = errors.filterNot { it.keyword == "format" && "email" in it.message }
        return real.joinToString("; ") { "${it.instanceLocation}: ${it.message}" }
    }

    private fun fail(operation: Operation, status: Int, reason: String): Nothing =
        throw AssertionError("La respuesta $status de ${operation.method} ${operation.template} no cumple el contrato: $reason")

    private fun escape(segment: String): String = segment.replace("~", "~0").replace("/", "~1")
}
