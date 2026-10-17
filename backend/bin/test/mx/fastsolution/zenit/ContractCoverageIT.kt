package mx.fastsolution.zenit

import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Tag
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * El contrato y el backend dicen lo mismo. Corre al final, cuando las demás
 * pruebas ya ejercitaron el API: cada respuesta que recibieron pasó por
 * `ContractCheck`.
 */
@Tag("integration")
@Order(Int.MAX_VALUE)
class ContractCoverageIT : ApiTestBase() {
    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private lateinit var mappings: RequestMappingHandlerMapping

    private fun shape(operation: String) = operation.replace(Regex("\\{[^}]+}"), "{}")

    @Test
    fun `the routes of the backend are exactly the operations of the contract`() {
        val inCode = mappings.handlerMethods.keys.flatMap { info ->
            val paths = info.pathPatternsCondition?.patternValues ?: emptySet()
            info.methodsCondition.methods.flatMap { method -> paths.map { "${method.name} ${it.removePrefix("/api/v1")}" } }
        }.filter { !it.contains("/error") }.map(::shape).toSet()
        val inContract = ContractCheck.described().map(::shape).toSet()

        assertEquals(emptySet(), inCode - inContract, "Rutas que el backend atiende y el contrato no describe")
        assertEquals(emptySet(), inContract - inCode, "Operaciones del contrato que el backend no atiende")
    }

    @Test
    fun `every operation answered well at least once and its body matched the schema`() {
        // La única operación que ninguna otra prueba llama: no pide credencial.
        assertEquals(200, call("GET", "/api/v1/system/status").status)

        val unchecked = ContractCheck.described() - ContractCheck.answeredOk
        assertEquals(emptySet(), unchecked, "Operaciones sin ninguna respuesta correcta comprobada contra su esquema")
        assertTrue(ContractCheck.checked.get() > ContractCheck.described().size, "Sólo se comprobaron ${ContractCheck.checked.get()} respuestas")
        // Deja a la vista cuánto se comprobó en esta corrida.
        java.io.File("build/contract-check.txt")
            .writeText(
                "${ContractCheck.checked.get()} respuestas y ${ContractCheck.requestsChecked.get()} cuerpos de petición comprobados, " +
                    "de ${ContractCheck.described().size} operaciones",
            )
    }

    @Test
    fun `the check itself rejects what the contract does not describe`() {
        val status = "GET" to "/api/v1/system/status"
        // Un cuerpo correcto pasa.
        val good = call(status.first, status.second).body
        ContractCheck.verify("GET", status.second, 200, "application/json", good)
        // Un campo obligatorio de menos, un formato roto, un estado que el contrato no lista y un tipo de contenido ajeno no pasan.
        assertFailsWith<AssertionError> { ContractCheck.verify("GET", status.second, 200, "application/json", "{}") }
        assertFailsWith<AssertionError> { ContractCheck.verify("GET", status.second, 201, "application/json", good) }
        assertFailsWith<AssertionError> { ContractCheck.verify("GET", status.second, 200, "text/html", good) }
        val problem = """{"type":"https://zenit.invalid/problems/forbidden","title":"Permiso insuficiente","status":403,"code":"forbidden","correlationId":"%s"}"""
        ContractCheck.verify("GET", "/api/v1/users", 403, "application/problem+json", problem.format("0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e"))
        assertFailsWith<AssertionError> { ContractCheck.verify("GET", "/api/v1/users", 403, "application/problem+json", problem.format("no-es-un-uuid")) }
        assertFailsWith<AssertionError> { ContractCheck.verify("GET", "/api/v1/users", 403, "application/json", problem.format("0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e")) }

        // Lo mismo con el cuerpo de una petición que el backend aceptó: de menos, fuera de rango y de más no pasan.
        val c = company()
        val site = """{"name":"Sede de prueba","timeZone":"America/Mexico_City","latitude":19.4,"longitude":-99.1,"radiusMeters":80}"""
        val made = call("POST", "/api/v1/sites", c.adminToken, site)
        assertEquals(201, made.status, made.toString())
        fun accepted(body: String) = ContractCheck.verify("POST", "/api/v1/sites", 201, "application/json", made.body, body)
        accepted(site)
        assertFailsWith<AssertionError> { accepted("""{"name":"Sede de prueba"}""") }
        assertFailsWith<AssertionError> { accepted(site.replace("\"radiusMeters\":80", "\"radiusMeters\":5")) }
        assertFailsWith<AssertionError> { accepted(site.dropLast(1) + ""","extra":true}""") }
        // Un cuerpo que el backend rechazó no se compara: rechazarlo es lo correcto.
        assertEquals(422, call("POST", "/api/v1/sites", c.adminToken, """{"name":"Sede de prueba"}""").status)
        assertTrue(ContractCheck.requestsChecked.get() > 0)
    }
}
