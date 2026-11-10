package mx.fastsolution.zenit.card

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import mx.fastsolution.zenit.capture.CaptureProperties
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PilotCardFormatTest {
    private val uid = PilotCardFormat.uid("A9C6CC10")!!
    private val token = ByteArray(16) { it.toByte() }

    private fun keys(on: Boolean = true, key: String? = ECKeyGenerator(Curve.P_256).generate().toJSONString()) =
        PilotCardKeys(CaptureProperties(pilotCards = on, pilotCardKey = key))

    @Test
    fun `the proof carries the uid, the code and a 64 byte signature`() {
        val signature = "A".repeat(86)
        val (u, t, s) = PilotCardFormat.proof("a9c6cc10.${PilotCardFormat.hex(token)}.$signature")!!
        assertContentEquals(uid, u)
        assertContentEquals(token, t)
        assertEquals(64, s.size)
        assertNull(PilotCardFormat.proof("a9c6cc10.${PilotCardFormat.hex(token)}"))
        assertNull(PilotCardFormat.proof("a9c6cc1.${PilotCardFormat.hex(token)}.$signature"))
        assertNull(PilotCardFormat.proof("a9c6cc10.${PilotCardFormat.hex(token)}.${"A".repeat(84)}"))
    }

    @Test
    fun `only 4, 7 and 10 byte identifiers are cards`() {
        assertEquals(4, PilotCardFormat.uid("a9c6cc10")!!.size)
        assertEquals(7, PilotCardFormat.uid("04a1b2c3d4e5f6")!!.size)
        assertNull(PilotCardFormat.uid("a9c6cc"))
        assertNull(PilotCardFormat.uid("zz c6cc10"))
    }

    @Test
    fun `the fingerprint binds the code to its card`() {
        val other = PilotCardFormat.uid("a9c6cc11")!!
        assertNotEquals(PilotCardFormat.fingerprint(uid, token), PilotCardFormat.fingerprint(other, token))
        assertEquals(64, PilotCardFormat.fingerprint(uid, token).length)
    }

    @Test
    fun `a signature only verifies for its uid, version and code`() {
        val keys = keys()
        val signature = keys.sign(PilotCardFormat.signedBytes(uid, 1, token))
        assertEquals(64, signature.size)
        assertTrue(keys.verify(PilotCardFormat.signedBytes(uid, 1, token), signature))
        assertFalse(keys.verify(PilotCardFormat.signedBytes(uid, 2, token), signature))
        assertFalse(keys.verify(PilotCardFormat.signedBytes(PilotCardFormat.uid("a9c6cc11")!!, 1, token), signature))
        assertFalse(keys().verify(PilotCardFormat.signedBytes(uid, 1, token), signature))
    }

    @Test
    fun `each company gets its own six byte sector key, always the same`() {
        val keys = keys()
        val a = UUID.randomUUID()
        assertEquals(6, keys.sectorKey(a).size)
        assertContentEquals(keys.sectorKey(a), keys.sectorKey(a))
        assertFalse(keys.sectorKey(a).contentEquals(keys.sectorKey(UUID.randomUUID())))
    }

    @Test
    fun `without the switch or the key the pilot is off`() {
        assertFalse(keys(on = false).enabled)
        assertFalse(keys(key = null).enabled)
        assertFalse(keys(key = "").enabled)
        assertTrue(keys().enabled)
        val public = ECKeyGenerator(Curve.P_256).generate().toPublicJWK().toJSONString()
        assertFailsWith<IllegalArgumentException> { keys(key = public) }
    }
}
