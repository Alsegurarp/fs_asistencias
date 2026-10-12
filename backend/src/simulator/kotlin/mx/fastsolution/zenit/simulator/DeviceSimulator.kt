package mx.fastsolution.zenit.simulator

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.JWSObject
import com.nimbusds.jose.Payload
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import java.util.UUID
import kotlin.system.exitProcess

/**
 * Simulador de dispositivo para el entorno local.
 *
 * Hace por el API lo mismo que harían una persona de la empresa y la app: da de
 * alta una sede, personas y tarjetas, activa un teléfono por persona y una
 * terminal, y manda marcajes firmados de las últimas horas. Sirve para que el
 * portal tenga jornadas, incidencias y cierres con qué construir sus
 * pantallas sin esperar a la app.
 *
 * Sólo con datos ficticios, y sólo donde el backend acepta la tarjeta
 * simulada. Las claves de los dispositivos se generan aquí, viven en memoria y
 * se descartan al terminar: nada de lo que imprime es un secreto.
 */
private const val CARD_SCHEME = "uid_sha256"
private const val APP_VERSION = "0.1.0-simulador"

/** Dónde está la sede simulada, y un punto fuera de su geocerca. */
private const val LATITUDE = 19.432608
private const val LONGITUDE = -99.133209
private const val FAR_LATITUDE = 19.44

private class Stop(message: String) : RuntimeException(message)

private class Reply(val status: Int, val body: JsonNode?) {
    val code: String get() = body?.get("code")?.asString() ?: ""
}

private class Api(private val base: String) {
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
    private val json = JsonMapper()

    fun call(method: String, path: String, credential: String?, body: Any? = null, idempotencyKey: String? = null): Reply {
        val request = HttpRequest.newBuilder(URI("$base/api/v1$path")).timeout(Duration.ofSeconds(30))
        if (credential != null) request.header("Authorization", "Bearer $credential")
        if (idempotencyKey != null) request.header("Idempotency-Key", idempotencyKey)
        if (body != null) request.header("Content-Type", "application/json")
        request.method(method, body?.let { HttpRequest.BodyPublishers.ofString(json.writeValueAsString(it)) } ?: HttpRequest.BodyPublishers.noBody())
        val response = http.send(request.build(), HttpResponse.BodyHandlers.ofString())
        return Reply(response.statusCode(), response.body().takeIf { it.isNotBlank() }?.let(json::readTree))
    }

    /** Llama y exige ese estado; si no, se detiene diciendo qué se pidió y qué código llegó. */
    fun expect(status: Int, method: String, path: String, credential: String?, body: Any? = null, idempotencyKey: String? = null): JsonNode {
        val reply = call(method, path, credential, body, idempotencyKey)
        if (reply.status != status) {
            throw Stop("$method $path respondió ${reply.status} ${reply.code}, y se esperaba $status. ${hint(reply)}")
        }
        return reply.body ?: throw Stop("$method $path respondió sin cuerpo.")
    }

    private fun hint(reply: Reply): String = when (reply.status) {
        401 -> "El token venció o no es de este entorno: dura cinco minutos, hay que obtener otro."
        403 -> "La cuenta del token no administra una empresa: hace falta el rol admin_empresa."
        429 -> "Se agotó la cuota de peticiones por minuto: hay que esperar un minuto y repetir."
        else -> reply.body?.get("errors")?.toString() ?: reply.body?.get("detail")?.asString() ?: ""
    }
}

/** Un dispositivo simulado: su clave, su identidad y la cuenta de sus marcajes. */
private class Device(val key: ECKey) {
    var id = ""
    var session = ""
    var audience = ""
    var sequence = 0

    /** Aserción con la que el dispositivo se identifica en cada petición. */
    fun assertion(): String {
        val now = Instant.now()
        val claims = JWTClaimsSet.Builder().issuer(id).subject(id).audience(audience)
            .issueTime(Date.from(now)).expirationTime(Date.from(now.plusSeconds(60))).build()
        return SignedJWT(JWSHeader.Builder(JWSAlgorithm.ES256).keyID(id).build(), claims).apply { sign(ECDSASigner(key)) }.serialize()
    }

    fun sign(payload: Map<String, Any?>, json: JsonMapper): String =
        JWSObject(JWSHeader.Builder(JWSAlgorithm.ES256).keyID(id).build(), Payload(json.writeValueAsString(payload)))
            .apply { sign(ECDSASigner(key)) }.serialize()
}

private class Person(val number: Int, val externalId: String, val employeeId: String, val card: String, val phone: Device)

/** Un marcaje por mandar: quién, con qué dispositivo, cuándo y desde dónde. */
private class Mark(val person: Person, val device: Device, val at: Instant, val latitude: Double = LATITUDE)

private class Scenario(val name: String, val marks: (Person, Device, Instant) -> List<Mark>)

private fun hours(value: Double): Long = (value * 3600).toLong()

/**
 * Lo que le pasa a cada persona. `start` cae en el día de ayer y a menos de 24
 * horas, así que sus marcajes no cuentan como sincronización tardía.
 */
private val SCENARIOS = listOf(
    Scenario("jornada de 8 horas, desde su teléfono") { p, _, start ->
        listOf(Mark(p, p.phone, start), Mark(p, p.phone, start.plusSeconds(hours(8.0))))
    },
    Scenario("jornada de 8 horas, en la terminal de la sede") { p, terminal, start ->
        listOf(Mark(p, terminal, start.plusSeconds(300)), Mark(p, terminal, start.plusSeconds(hours(8.0) + 300)))
    },
    Scenario("entrada fuera de la geocerca: deja una incidencia") { p, _, start ->
        listOf(Mark(p, p.phone, start.plusSeconds(600), FAR_LATITUDE), Mark(p, p.phone, start.plusSeconds(hours(8.0) + 600)))
    },
    Scenario("entrada sin salida: su semana no se puede cerrar") { p, _, start ->
        listOf(Mark(p, p.phone, start.plusSeconds(900)))
    },
    Scenario("lectura repetida a los 20 segundos: deja una incidencia") { p, _, start ->
        listOf(
            Mark(p, p.phone, start.plusSeconds(1200)), Mark(p, p.phone, start.plusSeconds(1220)),
            Mark(p, p.phone, start.plusSeconds(hours(8.0) + 1200)),
        )
    },
    Scenario("jornada de 11 horas: genera tiempo extra") { p, _, start ->
        listOf(Mark(p, p.phone, start), Mark(p, p.phone, start.plusSeconds(hours(11.0))))
    },
    Scenario("jornada de hace dos días que llega tarde: deja incidencias") { p, _, start ->
        listOf(Mark(p, p.phone, start.minusSeconds(hours(26.0))), Mark(p, p.phone, start.minusSeconds(hours(18.0))))
    },
)

private fun environment(name: String, default: String? = null): String =
    System.getenv(name)?.takeIf { it.isNotBlank() } ?: default ?: throw Stop("Falta la variable $name.")

fun main() {
    try {
        run()
    } catch (e: Stop) {
        System.err.println("El simulador se detuvo: ${e.message}")
        exitProcess(1)
    }
}

private fun run() {
    val api = Api(environment("SIM_API", "http://backend:8080").trimEnd('/'))
    val token = environment("SIM_TOKEN")
    val people = environment("SIM_PEOPLE", "8").toIntOrNull()?.takeIf { it in 1..50 } ?: throw Stop("SIM_PEOPLE debe ir de 1 a 50.")
    val finishedWeek = environment("SIM_FINISHED_WEEK", "true").toBoolean()
    val json = JsonMapper()
    val tag = UUID.randomUUID().toString().take(6)

    val me = api.expect(200, "GET", "/me", token)
    val roles = me.get("roles").values().map { it.asString() }
    if ("admin_empresa" !in roles) throw Stop("La cuenta del token tiene los roles $roles: hace falta admin_empresa.")
    var tenant = api.expect(200, "GET", "/tenant", token)
    val zone = ZoneId.of(tenant.get("timeZone").asString())
    val today = LocalDate.now(zone)
    if (finishedWeek) {
        // La semana empieza hoy: lo que se marca de ayer hacia atrás queda en una semana terminada, que ya se puede cerrar.
        tenant = api.expect(200, "PATCH", "/tenant", token, mapOf("weekStartsOn" to today.dayOfWeek.name.lowercase()))
    }
    println("Empresa: ${tenant.get("name").asString()} (${zone.id}); su semana empieza en ${tenant.get("weekStartsOn").asString()}.")

    val site = api.expect(
        201, "POST", "/sites", token,
        mapOf("name" to "Sede simulada $tag", "timeZone" to zone.id, "latitude" to LATITUDE, "longitude" to LONGITUDE, "radiusMeters" to 80),
    )
    val siteId = site.get("id").asString()
    println("Sede: ${site.get("name").asString()} ($siteId)")

    fun activate(enrollment: Map<String, Any?>): Device {
        val code = api.expect(201, "POST", "/device-enrollments", token, enrollment).get("code").asString()
        val device = Device(ECKeyGenerator(Curve.P_256).generate())
        val proof = JWSObject(JWSHeader(JWSAlgorithm.ES256), Payload(json.writeValueAsString(mapOf("enrollmentCode" to code))))
            .apply { sign(ECDSASigner(device.key)) }.serialize()
        val activation = api.expect(
            201, "POST", "/device-activations", null,
            mapOf(
                "enrollmentCode" to code,
                "publicKey" to device.key.toPublicJWK().toJSONObject(),
                "proof" to proof,
                "device" to mapOf("manufacturer" to "Simulado", "model" to "Simulador 1", "androidSdk" to 34, "appVersion" to APP_VERSION),
                "screenLock" to true,
            ),
        )
        device.id = activation.get("deviceId").asString()
        device.session = activation.get("session").get("sessionId").asString()
        device.audience = activation.get("audience").asString()
        return device
    }

    val staff = (1..people).map { number ->
        val externalId = "SIM-$tag-%02d".format(number)
        val employee = api.expect(
            201, "POST", "/employees", token,
            mapOf("externalId" to externalId, "displayName" to "Persona simulada $number", "siteId" to siteId, "employmentStart" to "2026-01-05"),
        )
        val employeeId = employee.get("id").asString()
        val fingerprint = UUID.randomUUID().toString().replace("-", "")
        val card = api.expect(201, "POST", "/cards", token, mapOf("label" to "SIM-$tag-%02d".format(number), "fingerprint" to fingerprint))
        api.expect(201, "POST", "/cards/${card.get("id").asString()}/assignments", token, mapOf("employeeId" to employeeId))
        Person(number, externalId, employeeId, fingerprint, activate(mapOf("mode" to "personal", "employeeId" to employeeId)))
    }
    val terminal = activate(mapOf("mode" to "terminal", "siteId" to siteId, "label" to "Terminal simulada $tag"))
    println("Personas: ${staff.size}, cada una con tarjeta y teléfono. Terminal: ${terminal.id}")

    // Hace casi 24 horas: todavía es ayer, y todavía no cuenta como sincronización tardía.
    val start = Instant.now().minusSeconds(hours(23.75))
    if (!start.atZone(zone).toLocalDate().isBefore(today)) {
        println("Aviso: a esta hora los marcajes de la jornada caen en el día de hoy; su semana todavía no termina y no se podrá cerrar.")
    }
    val outcomes = sortedMapOf<String, Int>()
    for (person in staff) {
        val scenario = SCENARIOS[(person.number - 1) % SCENARIOS.size]
        val results = scenario.marks(person, terminal, start).sortedBy { it.at }.map { mark ->
            val key = UUID.randomUUID().toString()
            val payload = linkedMapOf<String, Any?>(
                "envelopeVersion" to 1, "idempotencyKey" to key, "sessionId" to mark.device.session, "sequence" to ++mark.device.sequence,
                "observedAt" to mark.at.toString(), "timeZone" to zone.id, "card" to mapOf("scheme" to CARD_SCHEME, "proof" to person.card),
                "location" to mapOf(
                    "latitude" to mark.latitude, "longitude" to LONGITUDE, "accuracyMeters" to 12.0,
                    "capturedAt" to mark.at.toString(), "provider" to "fused", "mock" to false,
                ),
                "app" to mapOf("version" to APP_VERSION),
            )
            val reply = api.call("POST", "/attendance-events", mark.device.assertion(), mapOf("envelope" to mark.device.sign(payload, json)), key)
            // Un marcaje guardado responde 201; uno rechazado responde 200 con su recibo y el motivo.
            val outcome = when (reply.status) {
                200, 201 -> {
                    val rejection = reply.body?.get("rejection")?.takeIf { !it.isNull }?.get("code")?.asString()
                    val incident = reply.body?.get("incident")?.takeIf { !it.isNull }?.get("type")?.asString()
                    when {
                        rejection == "card_unknown" ->
                            throw Stop("El backend no reconoce la tarjeta simulada. Hay que levantarlo con CAPTURE_SIMULATED_CARDS=true.")
                        rejection != null -> "rechazado ($rejection)"
                        incident != null -> "aceptado con incidencia ($incident)"
                        else -> "aceptado"
                    }
                }
                else -> "error ${reply.status} ${reply.code}"
            }
            outcomes.merge(outcome, 1, Int::plus)
            outcome
        }
        println("  ${person.externalId}  ${person.employeeId}  ${scenario.name}: ${results.joinToString(", ")}")
    }

    println("Marcajes: " + outcomes.entries.joinToString("; ") { "${it.value} ${it.key}" })
    val week = start.atZone(zone).toLocalDate()
    println("Para verlos: GET /api/v1/employees/{id}/attendance?week=$week y GET /api/v1/incidents?status=open&week=$week")
    if (finishedWeek) println("Para cerrar esa semana: POST /api/v1/week-closure-runs con {\"weekStart\":\"$week\"}")
}
