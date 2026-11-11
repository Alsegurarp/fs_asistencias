package mx.fastsolution.zenit

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.TestPropertySource
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.time.Instant
import java.util.Base64
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Tarjetas Classic del piloto: código firmado ligado a su identificador, sin datos de la persona. */
@Tag("integration")
@TestPropertySource(properties = ["zenit.capture.pilot-cards=true", "zenit.capture.pilot-card-key-version=3"])
class PilotCardsIT : CaptureTestBase() {
    companion object {
        private val pilotKey = ECKeyGenerator(Curve.P_256).generate().toJSONString()

        @JvmStatic
        @DynamicPropertySource
        fun pilot(registry: DynamicPropertyRegistry) {
            registry.add("zenit.capture.pilot-card-key") { pilotKey }
        }
    }

    private fun issue(t: Phone, uid: String): Reply = call("POST", "/api/v1/device-cards/credentials", assertion(t), """{"uid":"$uid"}""")

    private fun register(t: Phone, uid: String, token: String, signature: String, keyVersion: Int = 3): Reply = call(
        "POST", "/api/v1/device-cards", assertion(t),
        """{"uid":"$uid","keyVersion":$keyVersion,"token":"$token","signature":"$signature"}""",
    )

    private fun uid() = java.util.UUID.randomUUID().toString().replace("-", "").take(8)

    /** Lo que la terminal escribe y luego da de alta. */
    private data class Written(val uid: String, val token: String, val signature: String, val cardId: String, val label: String)

    private fun written(c: Company, t: Phone, uid: String = uid()): Written {
        val credential = issue(t, uid)
        assertEquals(200, credential.status, credential.toString())
        assertEquals(3, credential.at<Int>("keyVersion"))
        val token = credential.at<String>("token")
        val signature = credential.at<String>("signature")
        val card = register(t, uid, token, signature)
        assertEquals(201, card.status, card.toString())
        assertEquals("inventory", card.at("status"))
        return Written(uid, token, signature, card.at("id"), card.at("label"))
    }

    private fun assign(c: Company, cardId: String, employeeId: String) {
        val reply = call("POST", "/api/v1/cards/$cardId/assignments", c.adminToken, """{"employeeId":"$employeeId"}""")
        assertEquals(201, reply.status, reply.toString())
    }

    private fun pilotMark(p: Phone, proof: String, keyVersion: Int = 3): Reply {
        val key = java.util.UUID.randomUUID().toString()
        return submit(p, envelope(p, proof, Instant.now().minusSeconds(30), key, scheme = "mifare_classic_signed", keyVersion = keyVersion), key)
    }

    @Test
    fun `a terminal writes a signed card, the portal assigns it and the card marks`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        val t = terminal(c, siteId, elsewhere())
        val card = written(c, t)
        assertTrue(card.label.startsWith("ZC-"), card.label)

        // Repetir el alta de la misma tarjeta devuelve la que ya existe.
        val again = register(t, card.uid, card.token, card.signature)
        assertEquals(200, again.status, again.toString())
        assertEquals(card.cardId, again.at("id"))

        assign(c, card.cardId, employeeId)
        val reply = pilotMark(t, "${card.uid}.${card.token}.${card.signature}")
        assertEquals(201, reply.status, reply.toString())
        assertEquals("clock_in", reply.at("type"))

        // El detalle dice que la registró la terminal y que ella la leyó.
        val detail = call("GET", "/api/v1/cards/${card.cardId}", c.adminToken)
        assertEquals("device", detail.at("registeredBy.type"))
        assertEquals("Recepción", detail.at("registeredBy.name"))
        assertEquals("Recepción", detail.at("lastRead.deviceName"))

        // El alta queda en la bitácora a nombre del dispositivo, sin la huella.
        val audit = call("GET", "/api/v1/audit-log?limit=200", c.adminToken)
        assertEquals(200, audit.status, audit.toString())
        assertTrue(audit.body.contains("card.registered") && !audit.body.contains(card.token), audit.body)
    }

    @Test
    fun `the session hands the sector key and the key that checks signatures without network`() {
        val c = company()
        val siteId = newSite(c)
        val t = terminal(c, siteId, elsewhere())
        val session = call("POST", "/api/v1/device-sessions", assertion(t), """{"appVersion":"0.1.0"}""")
        assertEquals(201, session.status, session.toString())
        assertEquals("mifare_classic_signed", session.at("pilotCards.scheme"))
        assertEquals(3, session.at<Int>("pilotCards.keyVersion"))
        val sectorKey = session.at<String>("pilotCards.sectorKey")
        assertTrue(Regex("^[0-9a-f]{12}$").matches(sectorKey), sectorKey)

        // Cada empresa tiene su propia clave de sectores.
        val other = company()
        val otherTerminal = terminal(other, newSite(other), elsewhere())
        val otherSession = call("POST", "/api/v1/device-sessions", assertion(otherTerminal), """{"appVersion":"0.1.0"}""")
        assertNotEquals(sectorKey, otherSession.at<String>("pilotCards.sectorKey"))

        // La firma emitida se comprueba con la clave pública de la sesión, como lo hará el teléfono.
        val uid = uid()
        val credential = issue(t, uid)
        val public = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(session.at<String>("pilotCards.verificationKey"))))
        val verifier = Signature.getInstance("SHA256withECDSAinP1363Format").apply {
            initVerify(public)
            update("zenit-classic-v1".toByteArray() + byteArrayOf(4) + hex(uid) + byteArrayOf(3) + hex(credential.at("token")))
        }
        assertTrue(verifier.verify(Base64.getUrlDecoder().decode(credential.at<String>("signature"))))
    }

    @Test
    fun `a forged or copied card does not mark`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        val t = terminal(c, siteId, elsewhere())
        val card = written(c, t)
        assign(c, card.cardId, employeeId)

        // El mismo código en otra tarjeta: la firma está ligada al identificador.
        val copied = pilotMark(t, "${uid()}.${card.token}.${card.signature}")
        assertEquals("rejected", copied.at("outcome"))
        assertEquals("card_unknown", copied.at("rejection.code"))

        // Un código inventado, con la firma de otro.
        val forged = pilotMark(t, "${card.uid}.${"ab".repeat(16)}.${card.signature}")
        assertEquals("card_unknown", forged.at("rejection.code"))

        // Otra versión de la clave.
        val oldKey = pilotMark(t, "${card.uid}.${card.token}.${card.signature}", keyVersion = 2)
        assertEquals("card_unknown", oldKey.at("rejection.code"))

        // Dar de alta una firma alterada no se acepta.
        val tampered = register(t, card.uid, "cd".repeat(16), card.signature)
        assertProblem(422, "validation", tampered)
        assertEquals("invalid_signature", tampered.at("errors[0].code"))
    }

    @Test
    fun `a signed card that was not registered or was revoked does not mark`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        val t = terminal(c, siteId, elsewhere())
        val uid = uid()
        val credential = issue(t, uid)
        val proof = "$uid.${credential.at<String>("token")}.${credential.at<String>("signature")}"
        assertEquals("card_unknown", pilotMark(t, proof).at("rejection.code"))

        val card = written(c, t)
        assign(c, card.cardId, employeeId)
        val revoked = call("POST", "/api/v1/cards/${card.cardId}/revocation", c.adminToken, """{"reason":"lost"}""")
        assertEquals(200, revoked.status, revoked.toString())
        assertEquals("card_revoked", pilotMark(t, "${card.uid}.${card.token}.${card.signature}").at("rejection.code"))
    }

    @Test
    fun `only an active terminal prepares cards`() {
        val c = company()
        val siteId = newSite(c)
        val employeeId = newEmployee(c, siteId)
        val p = phone(c, employeeId)
        assertEquals(403, issue(p, uid()).status)
        assertEquals(403, register(p, uid(), "ab".repeat(16), "A".repeat(86)).status)
        val badUid = issue(terminal(c, siteId, elsewhere()), "123")
        assertProblem(422, "validation", badUid)
        assertEquals("invalid_uid", badUid.at("errors[0].code"))
        // Una persona del portal no usa estas rutas.
        assertEquals(401, call("POST", "/api/v1/device-cards/credentials", c.adminToken, """{"uid":"${uid()}"}""").status)
    }

    private fun hex(value: String) = java.util.HexFormat.of().parseHex(value)
}

/** Sin pedirlo, ni con clave, las tarjetas del piloto no marcan ni se preparan. */
@Tag("integration")
class PilotCardsOffIT : CaptureTestBase() {
    @Test
    fun `pilot cards are refused unless the environment turns them on`() {
        val c = company()
        val siteId = newSite(c)
        val t = terminal(c, siteId, elsewhere())
        assertProblem(409, "pilot_cards_disabled", call("POST", "/api/v1/device-cards/credentials", assertion(t), """{"uid":"a9c6cc10"}"""))
        val session = call("POST", "/api/v1/device-sessions", assertion(t), """{"appVersion":"0.1.0"}""")
        assertNull(session.at<Any?>("pilotCards"))
        val key = java.util.UUID.randomUUID().toString()
        val reply = submit(t, envelope(t, "a9c6cc10.${"ab".repeat(16)}.${"A".repeat(86)}", Instant.now().minusSeconds(30), key, scheme = "mifare_classic_signed", keyVersion = 1), key)
        assertEquals("card_unknown", reply.at("rejection.code"))
    }
}
