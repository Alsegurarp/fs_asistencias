package mx.fastsolution.zenit

import org.junit.jupiter.api.MethodOrderer
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.TestMethodOrder
import org.springframework.test.context.TestPropertySource
import java.sql.DriverManager
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Dispositivos y captura con tarjeta simulada, con dos empresas. */
@Tag("integration")
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class CaptureIT : CaptureTestBase() {
    private fun ago(minutes: Long): Instant = Instant.now().minusSeconds(minutes * 60)

    private fun sql(statement: String, vararg values: Any): Int =
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement(statement).use {
                values.forEachIndexed { index, value -> it.setObject(index + 1, value) }
                if (statement.trimStart().startsWith("select", ignoreCase = true)) {
                    it.executeQuery().use { rows -> if (rows.next()) rows.getInt(1) else 0 }
                } else {
                    it.executeUpdate()
                }
            }
        }

    private fun events(c: Company, query: String = ""): Reply =
        call("GET", "/api/v1/attendance-events?from=${ago(60 * 24 * 5)}&to=${Instant.now().plusSeconds(3600)}$query", c.adminToken)

    private fun rejected(expectedCode: String, reply: Reply) {
        assertEquals(200, reply.status, reply.toString())
        assertEquals("rejected", reply.at("outcome"))
        assertEquals(expectedCode, reply.at("rejection.code"))
        assertNull(reply.at<Any?>("eventId"))
    }

    @Test
    fun `enrolling fixes the mode and the code works once, with proof of the key`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)

        // La modalidad decide a qué se liga el dispositivo.
        for (body in listOf(
            """{"mode":"personal"}""", """{"mode":"terminal"}""", """{"mode":"tableta","siteId":"$siteId"}""",
            """{"mode":"personal","employeeId":"$employeeId","siteId":"$siteId"}""",
            """{"mode":"terminal","siteId":"$siteId","employeeId":"$employeeId"}""",
            """{"mode":"personal","employeeId":"${UUID.randomUUID()}"}""", """{"mode":"terminal","siteId":"${UUID.randomUUID()}"}""",
        )) {
            assertProblem(422, "validation", enroll(c, body))
        }
        assertProblem(403, "forbidden", call("POST", "/api/v1/device-enrollments", member(c, "supervisor").token, """{"mode":"personal","employeeId":"$employeeId"}"""))
        assertProblem(401, "unauthorized", call("POST", "/api/v1/device-enrollments", null, "{}"))

        val enrollment = enroll(c, """{"mode":"personal","employeeId":"$employeeId"}""")
        assertEquals(201, enrollment.status, enrollment.toString())
        assertEquals("pending", enrollment.at("status"))
        val code = enrollment.at<String>("code")
        assertTrue(Regex("^[A-Z2-9]{5}-[A-Z2-9]{5}$").matches(code), code)

        // Sin bloqueo de pantalla, con una clave que trae su parte privada, con una
        // prueba de otra clave o de otro código, no se activa; y el código sigue vivo.
        val key = newKey()
        assertProblem(422, "validation", activation(code, key, screenLock = false))
        assertProblem(422, "validation", activation(code, key, jwk = key.toJSONString()))
        assertProblem(422, "validation", activation(code, key, proof = proof(newKey(), code)))
        assertProblem(422, "validation", activation(code, key, proof = proof(key, "OTRO-CODIGO")))
        assertProblem(422, "validation", activation(code, key, sdk = 27))
        assertProblem(422, "validation", call("POST", "/api/v1/device-activations", null, "{}"))

        val activated = activation(code.lowercase().replace("-", " "), key, proof = proof(key, code))
        assertEquals(201, activated.status, activated.toString())
        assertEquals("personal", activated.at("mode"))
        assertEquals(employeeId, activated.at("employee.id"))
        assertNull(activated.at<Any?>("site"))
        assertEquals("zenit-capture", activated.at("audience"))
        assertEquals("not_considered", activated.at("session.breakPolicy"))
        assertEquals(120, activated.at<Int>("session.tokenMaxAgeSeconds"))
        assertEquals(0, activated.at<Int>("session.locationReuseSeconds"))
        assertEquals(listOf(72, 1000), listOf(activated.at<Int>("session.offlinePolicy.maxAgeHours"), activated.at<Int>("session.offlinePolicy.maxEvents")))
        val first = activated.at<String>("deviceId")

        // El código es de un solo uso, y una clave pertenece a un solo dispositivo.
        assertProblem(410, "enrollment_gone", activation(code, newKey()))
        assertProblem(410, "enrollment_gone", activation("AAAAA-22222", newKey()))
        val again = enroll(c, """{"mode":"personal","employeeId":"$employeeId"}""").at<String>("code")
        assertProblem(422, "validation", activation(again, key))

        // El teléfono nuevo de una persona cierra el anterior en la misma operación.
        val second = Phone(newKey())
        second.id = activation(again, second.key).at("deviceId")
        val listed = call("GET", "/api/v1/devices?mode=personal", c.adminToken)
        assertEquals(listOf(first, second.id), listed.list("items[*].id"))
        assertEquals(listOf("replaced", "active"), listed.list("items[*].status"))
        assertEquals(listOf(second.id), call("GET", "/api/v1/devices?status=active", c.adminToken).list("items[*].id"))
        // La clave pública no sale en las listas.
        assertFalse("kty" in listed.body || "public" in listed.body.lowercase())

        // Una terminal se liga a su sede y puede reutilizar la ubicación entre lecturas.
        val terminalCode = enroll(c, """{"mode":"terminal","siteId":"$siteId","label":"Recepción"}""").at<String>("code")
        val terminal = activation(terminalCode, newKey())
        assertEquals("terminal", terminal.at("mode"))
        assertEquals(siteId, terminal.at("site.id"))
        assertNull(terminal.at<Any?>("employee"))
        assertEquals(30, terminal.at<Int>("session.locationReuseSeconds"))

        // Un código vencido ya no sirve, y queda marcado como vencido.
        val expiring = enroll(c, """{"mode":"terminal","siteId":"$siteId"}""")
        sql("update device_enrollment set expires_at = now() - interval '1 minute' where id = ?", UUID.fromString(expiring.at("id")))
        assertProblem(410, "enrollment_gone", activation(expiring.at("code"), newKey()))
        assertEquals(1, sql("select count(*) from device_enrollment where id = ? and status = 'expired'", UUID.fromString(expiring.at("id"))))
        assertEquals(1, call("GET", "/api/v1/audit-log?action=device.activated&limit=1", c.adminToken).at<Int>("items.length()"))
    }

    @Test
    fun `a device proves who it is with a short assertion signed by its own key`() {
        val c = company()
        val p = phone(c, newEmployee(c))
        fun session(token: String?) = call("POST", "/api/v1/device-sessions", token, """{"appVersion":"0.1.1"}""")

        val opened = session(assertion(p))
        assertEquals(201, opened.status, opened.toString())
        assertNotEquals(p.session, opened.at<String>("sessionId"))
        assertProblem(422, "validation", call("POST", "/api/v1/device-sessions", assertion(p), "{}"))

        val unauthorized = session(null)
        assertProblem(401, "unauthorized", unauthorized)
        // El 401 trae la hora del servidor, para que un teléfono con el reloj movido se corrija.
        Instant.parse(unauthorized.at("serverTime"))
        // Cada credencial sólo sirve en sus rutas.
        assertProblem(401, "unauthorized", session(c.adminToken))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/devices", assertion(p)))
        assertProblem(401, "unauthorized", call("GET", "/api/v1/me", assertion(p)))
        assertProblem(401, "unauthorized", session(assertion(p, audience = "zenit-api")))
        assertProblem(401, "unauthorized", session(assertion(p, issuedAgo = 600)))
        assertProblem(401, "unauthorized", session(assertion(p, lifetime = 3600)))
        assertProblem(401, "unauthorized", session(assertion(p, signer = newKey())))
        assertProblem(401, "unauthorized", session(assertion(p, issuer = UUID.randomUUID().toString())))
        val other = phone(c, newEmployee(c))
        assertProblem(401, "unauthorized", session(assertion(p, issuer = other.id)))

        // Revocado, su clave deja de valer; no se revoca dos veces.
        assertProblem(422, "validation", call("POST", "/api/v1/devices/${p.id}/revocation", c.adminToken, """{"reason":"no"}"""))
        val revoked = call("POST", "/api/v1/devices/${p.id}/revocation", c.adminToken, """{"reason":"Teléfono extraviado"}""")
        assertEquals(200, revoked.status, revoked.toString())
        assertEquals("revoked", revoked.at("status"))
        assertProblem(409, "device_not_active", call("POST", "/api/v1/devices/${p.id}/revocation", c.adminToken, """{"reason":"Otra vez más"}"""))
        assertProblem(401, "unauthorized", session(assertion(p)))
        assertEquals(201, session(assertion(other)).status)
    }

    @Test
    fun `a mark is saved once, with the type the server decides and without exposing the coordinate`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        val card = newCard(c, employeeId)
        val p = phone(c, employeeId)

        val key = UUID.randomUUID().toString()
        val entry = envelope(p, card, ago(180), key)
        val saved = submit(p, entry, key)
        assertEquals(201, saved.status, saved.toString())
        assertEquals("accepted", saved.at("outcome"))
        assertEquals("clock_in", saved.at("type"))
        assertEquals("inside", saved.at("locationVerdict"))
        assertEquals(siteId, saved.at("site.id"))
        assertTrue(saved.at<String>("employee.displayName").startsWith("Persona "))
        assertNull(saved.at<Any?>("incident"))
        assertNull(saved.at<Any?>("rejection"))

        // La misma clave devuelve el mismo recibo; con otro sobre no se acepta.
        val repeated = submit(p, entry, key)
        assertEquals(200, repeated.status, repeated.toString())
        assertEquals(saved.body, repeated.body)
        assertProblem(409, "idempotency_conflict", submit(p, envelope(p, card, ago(170), key), key))
        assertProblem(422, "validation", submit(p, entry, UUID.randomUUID().toString()))
        assertProblem(422, "validation", submit(p, entry, null))
        assertProblem(422, "validation", submit(p, "no es un sobre", key))

        assertEquals("clock_out", mark(p, card, ago(60)).at("type"))
        // Dos lecturas seguidas son la misma marca, no una entrada más.
        val twice = mark(p, card, ago(60).plusSeconds(30))
        assertEquals(201, twice.status, twice.toString())
        assertEquals(listOf("clock_out", "accepted_with_incident", "duplicate"), listOf(twice.at("type"), twice.at("outcome"), twice.at<String>("incident.type")))
        // Donde la comida no se considera, declarar un descanso no cuenta.
        assertEquals("clock_in", mark(p, card, ago(30), declared = "break_start").at("type"))

        val listed = events(c)
        assertEquals(200, listed.status, listed.toString())
        assertEquals(listOf("clock_in", "clock_out", "clock_out", "clock_in"), listed.list("items[*].type"))
        assertEquals(saved.at<String>("eventId"), listed.at("items[0].id"))
        assertEquals(64, listed.at<String>("items[0].payloadHash").length)
        assertTrue(listed.at<Int>("items[0].delaySeconds") > 3600)
        assertEquals(1, listed.at<Int>("items[2].incidentIds.length()"))
        assertEquals(12.0, listed.at<Number>("items[0].accuracyMeters").toDouble())
        // El portal recibe el veredicto y la precisión; la coordenada se queda en la base.
        assertFalse("latitude" in listed.body || "longitude" in listed.body || "envelope" in listed.body)
        assertEquals(4, sql("select count(*) from location_evidence l join attendance_event e on e.tenant_id = l.tenant_id and e.id = l.event_id where e.employee_id = ?", UUID.fromString(employeeId)))

        assertEquals(4, events(c, "&employeeId=$employeeId&siteId=$siteId").at<Int>("items.length()"))
        assertEquals(0, events(c, "&employeeId=${UUID.randomUUID()}").at<Int>("items.length()"))
        assertEquals(2, events(c, "&limit=2").at<Int>("items.length()"))
        assertProblem(422, "validation", call("GET", "/api/v1/attendance-events", c.adminToken))
        assertProblem(422, "validation", call("GET", "/api/v1/attendance-events?from=ayer&to=hoy", c.adminToken))
        assertProblem(403, "forbidden", call("GET", "/api/v1/attendance-events?from=${ago(60)}&to=${Instant.now()}", member(c, "trabajador").token))
        assertEquals(200, call("GET", "/api/v1/attendance-events?from=${ago(60)}&to=${Instant.now()}", member(c, "supervisor").token).status)
    }

    @Test
    fun `where the break is marked the server follows the day and a declaration corrects it`() {
        val c = company()
        assertEquals(200, call("PATCH", "/api/v1/tenant", c.adminToken, """{"breakPolicy":"marked"}""").status)
        val employeeId = newEmployee(c)
        val card = newCard(c, employeeId)
        val p = phone(c, employeeId)

        assertEquals(listOf("clock_in", "break_start", "break_end", "clock_out"), listOf(240L, 180L, 150L, 60L).map { mark(p, card, ago(it)).at<String>("type") })
        // Otra persona se va sin tomar descanso: lo declara, y es válido.
        val otherId = newEmployee(c)
        val otherCard = newCard(c, otherId)
        val other = phone(c, otherId)
        assertEquals("clock_in", mark(other, otherCard, ago(120)).at("type"))
        val left = mark(other, otherCard, ago(30), declared = "clock_out")
        assertEquals(listOf("clock_out", "accepted"), listOf(left.at("type"), left.at<String>("outcome")))
        // Una salida sin entrada no se pierde: se guarda y queda para revisión.
        val lone = mark(other, otherCard, ago(10), declared = "clock_out")
        assertEquals(listOf("clock_out", "accepted_with_incident", "missing_pair"), listOf(lone.at("type"), lone.at("outcome"), lone.at<String>("incident.type")))
    }

    @Test
    fun `what does not match is rejected with a receipt, stays rejected and creates no mark`() {
        val c = company()
        val employeeId = newEmployee(c)
        val card = newCard(c, employeeId)
        val p = phone(c, employeeId)
        assertEquals(201, mark(p, card, ago(300)).status)

        // Tarjeta desconocida: rechazada, y repetir la clave devuelve el mismo rechazo.
        val key = UUID.randomUUID().toString()
        val unknown = envelope(p, fingerprint(), ago(200), key)
        val first = submit(p, unknown, key)
        rejected("card_unknown", first)
        assertEquals(first.body, submit(p, unknown, key).body)

        rejected("card_unknown", mark(p, newCard(c), ago(199)))
        val someoneElse = newEmployee(c)
        rejected("card_not_owner", mark(p, newCard(c, someoneElse), ago(198)))
        rejected("card_unknown", mark2(p, envelope(p, card, ago(197), scheme = "desfire_ev3_aes")))
        rejected("payload_invalid", mark2(p, envelope(p, card, ago(196), extra = mapOf("tenantId" to c.id))))
        rejected("signature_invalid", mark2(p, envelope(p, card, ago(195), signer = newKey())))
        rejected("signature_invalid", mark2(p, envelope(p, card, ago(194), kid = UUID.randomUUID().toString())))
        rejected("session_invalid", mark2(p, envelope(p, card, ago(193), session = UUID.randomUUID().toString())))
        rejected("session_invalid", mark2(p, envelope(p, card, ago(192), sequence = 1)))
        rejected("session_invalid", mark2(p, envelope(p, card, ago(191), sequence = 1001)))
        rejected("too_old", mark2(p, envelope(p, card, ago(60 * 80))))

        // Tarjeta perdida y persona dada de baja: la tarjeta deja de marcar.
        val lostId = call("GET", "/api/v1/employees/$employeeId", c.adminToken).at<String>("activeCardId")
        assertEquals(200, call("POST", "/api/v1/cards/$lostId/revocation", c.adminToken, """{"reason":"lost"}""").status)
        rejected("card_revoked", mark(p, card, ago(100)))
        val leavingId = newEmployee(c)
        val leavingCard = newCard(c, leavingId)
        val leaving = phone(c, leavingId)
        assertEquals(201, mark(leaving, leavingCard, ago(100)).status)
        assertEquals(200, call("PATCH", "/api/v1/employees/$leavingId", c.adminToken, """{"status":"inactive"}""").status)
        rejected("card_revoked", mark(leaving, leavingCard, ago(50)))

        // Nada de lo rechazado creó un marcaje, y cada rechazo quedó como rastro.
        assertEquals(2, events(c).at<Int>("items.length()"))
        assertTrue(sql("select count(*) from attendance_rejection where tenant_id = ?", UUID.fromString(c.id)) >= 12)
    }

    private fun mark2(p: Phone, envelope: String): Reply = call(
        "POST", "/api/v1/attendance-events/batch", assertion(p), """{"envelopes":["$envelope"]}""",
    ).let { batch ->
        assertEquals(200, batch.status, batch.toString())
        Reply(200, json(batch.at<Map<String, Any?>>("receipts[0]")), batch.contentType)
    }

    @Test
    fun `location and clocks open incidents instead of deciding alone`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        val card = newCard(c, employeeId)
        val p = phone(c, employeeId)
        fun verdictAndIncident(reply: Reply) = reply.at<String>("locationVerdict") to reply.at<String?>("incident.type")

        // Fuera de la sede, con buena precisión.
        assertEquals("outside" to "foreign_site", verdictAndIncident(mark(p, card, ago(600), location = here(latitude = 19.44))))
        // Menos precisa que el radio: no se interpreta como fuera.
        assertEquals("inconclusive" to "location_inconclusive", verdictAndIncident(mark(p, card, ago(540), location = here(accuracy = 200.0, latitude = 19.44))))
        assertEquals("inconclusive" to "location_inconclusive", verdictAndIncident(mark(p, card, ago(480), location = here(mock = true))))
        assertEquals("not_evaluated" to "location_inconclusive", verdictAndIncident(mark(p, card, ago(420), location = null)))
        // Hora del dispositivo adelantada veinte minutos.
        val ahead = mark(p, card, Instant.now().plusSeconds(1200))
        assertEquals(listOf("accepted_with_incident", "clock_anomaly"), listOf(ahead.at("outcome"), ahead.at<String>("incident.type")))

        // Quien no tiene sede no se evalúa, y eso no es una incidencia.
        val roamingId = newEmployee(c)
        val roamingCard = newCard(c, roamingId)
        val roaming = phone(c, roamingId)
        val free = mark(roaming, roamingCard, ago(120))
        assertEquals(listOf("accepted", "not_evaluated"), listOf(free.at("outcome"), free.at<String>("locationVerdict")))
        assertNull(free.at<Any?>("site"))
        // Un marcaje que llega más de un día después se guarda con incidencia.
        val late = mark(roaming, roamingCard, ago(60 * 30))
        assertEquals(listOf("accepted_with_incident", "late_sync"), listOf(late.at("outcome"), late.at<String>("incident.type")))
    }

    @Test
    fun `a terminal accepts any active card of its company and a batch answers one receipt per envelope`() {
        val a = company()
        val b = company()
        val siteA = newSite(a)
        val otherSiteA = newSite(a)
        val local = newEmployee(a, siteA)
        val visitor = newEmployee(a, otherSiteA)
        val localCard = newCard(a, local)
        val visitorCard = newCard(a, visitor)
        val foreignCard = newCard(b, newEmployee(b))
        val t = terminal(a, siteA)

        val body = json(mapOf("envelopes" to listOf(envelope(t, localCard, ago(90)), envelope(t, foreignCard, ago(89)), envelope(t, visitorCard, ago(88)))))
        val batch = call("POST", "/api/v1/attendance-events/batch", assertion(t), body)
        assertEquals(200, batch.status, batch.toString())
        assertEquals(listOf("accepted", "rejected", "accepted_with_incident"), batch.list("receipts[*].outcome"))
        // La tarjeta de otra empresa no existe para esta terminal.
        assertEquals("card_unknown", batch.at("receipts[1].rejection.code"))
        // Quien es de otra sede marca, y queda para revisión.
        assertEquals("foreign_site", batch.at("receipts[2].incident.type"))
        assertTrue(batch.at<String>("receipts[0].employee.displayName").startsWith("Persona "))

        // Reenviar el lote devuelve los mismos recibos y no duplica nada.
        assertEquals(batch.body, call("POST", "/api/v1/attendance-events/batch", assertion(t), body).body)
        assertEquals(2, events(a).at<Int>("items.length()"))
        assertProblem(422, "validation", call("POST", "/api/v1/attendance-events/batch", assertion(t), """{"envelopes":[]}"""))
        assertProblem(422, "validation", call("POST", "/api/v1/attendance-events/batch", assertion(t), json(mapOf("envelopes" to List(101) { "a.b.c" }))))
        assertProblem(401, "unauthorized", call("POST", "/api/v1/attendance-events/batch", a.adminToken, """{"envelopes":["a.b.c"]}"""))

        // Dos empresas: ni dispositivos ni marcajes de la otra.
        val deviceOfB = phone(b, newEmployee(b))
        assertEquals(listOf(t.id), call("GET", "/api/v1/devices", a.adminToken).list("items[*].id"))
        assertProblem(404, "not_found", call("POST", "/api/v1/devices/${deviceOfB.id}/revocation", a.adminToken, """{"reason":"No es nuestro"}"""))
        assertProblem(422, "validation", enroll(a, """{"mode":"personal","employeeId":"${newEmployee(b)}"}"""))
        assertEquals(0, events(b).at<Int>("items.length()"))
        assertFalse(t.id in call("GET", "/api/v1/audit-log?limit=200", b.adminToken).body)
    }

    @Test
    fun `behind the proxy each visitor is cut off apart`() {
        // Las pruebas llaman desde 127.0.0.1, una dirección interna: como el portal en el servidor.
        val first = "203.0.113.10"
        val replies = (1..11).map { activation("ZZZZZ-${40000 + it}", newKey(), forwardedFor = "$first, 172.30.88.2").status }

        assertEquals(410, replies.first())
        assertEquals(429, replies.last())
        // Otro visitante detrás del mismo proxy todavía puede activar.
        assertProblem(410, "enrollment_gone", activation("ZZZZZ-49999", newKey(), forwardedFor = "203.0.113.20"))
    }

    @Test
    @Order(Int.MAX_VALUE)
    fun `guessing enrollment codes is cut off`() {
        val replies = (1..12).map { activation("ZZZZZ-${it.toString().padStart(5, '2')}", newKey()).status }

        // Los primeros intentos responden que el código no existe; después, que son demasiados.
        assertEquals(410, replies.first())
        assertEquals(429, replies.last())
        assertTrue(replies.indexOf(429) <= 10, replies.toString())
        assertProblem(429, "rate_limited", activation("ZZZZZ-99999", newKey()))
    }
}

/** Sin pedirlo, la tarjeta simulada no marca. */
@Tag("integration")
@TestPropertySource(properties = ["zenit.capture.simulated-cards=false"])
class CaptureOffIT : CaptureTestBase() {
    @Test
    fun `the simulated card is rejected unless the environment turns it on`() {
        val c = company()
        val employeeId = newEmployee(c)
        val card = newCard(c, employeeId)
        val p = phone(c, employeeId)

        val reply = mark(p, card, Instant.now().minusSeconds(60))

        assertEquals(200, reply.status, reply.toString())
        assertEquals("rejected", reply.at("outcome"))
        assertEquals("card_unknown", reply.at("rejection.code"))
        assertEquals(0, call("GET", "/api/v1/attendance-events?from=${Instant.now().minusSeconds(3600)}&to=${Instant.now().plusSeconds(60)}", c.adminToken).at<Int>("items.length()"))
    }
}
