package mx.fastsolution.zenit.mobile.capture

import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PilotCardFormatTest {
    private val uid = PilotCardFormat.parseHex("a9c6cc10")
    private val token = ByteArray(16) { (it * 7).toByte() }
    private val pair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    private val verificationKey = Base64.getEncoder().encodeToString(pair.public.encoded)

    /** Firma como el servidor: P-256, SHA-256, `r || s` de 64 bytes. */
    private fun sign(uid: ByteArray, keyVersion: Int, token: ByteArray): ByteArray {
        val der = Signature.getInstance("SHA256withECDSA").apply { initSign(pair.private); update(PilotCardFormat.signedBytes(uid, keyVersion, token)) }.sign()
        // DER: 30 len 02 lr r 02 ls s
        var index = 2
        fun next(): ByteArray {
            val length = der[index + 1].toInt()
            val value = der.copyOfRange(index + 2, index + 2 + length)
            index += 2 + length
            return value.dropWhile { it.toInt() == 0 }.toByteArray().let { ByteArray(32 - it.size) + it }
        }
        return next() + next()
    }

    @Test
    fun theCardHoldsOnlyTheMarkerVersionCodeAndSignature() {
        val credential = PilotCredential(uid, 1, token, sign(uid, 1, token))
        val bytes = PilotCardFormat.encode(credential)
        assertEquals(96, bytes.size)
        assertEquals("ZNC1", String(bytes.copyOfRange(0, 4), Charsets.US_ASCII))
        assertTrue(bytes.copyOfRange(85, 96).all { it.toInt() == 0 })
        val read = PilotCardFormat.decode(uid, bytes)!!
        assertArrayEquals(token, read.token)
        assertArrayEquals(credential.signature, read.signature)
        assertEquals(1, read.keyVersion)
        assertNull(PilotCardFormat.decode(uid, ByteArray(96)))
        assertNull(PilotCardFormat.decode(uid, ByteArray(95)))
    }

    @Test
    fun theSignatureIsCheckedWithoutNetworkAndIsBoundToTheCard() {
        val signature = sign(uid, 1, token)
        assertTrue(PilotCardFormat.verify(PilotCredential(uid, 1, token, signature), verificationKey))
        // Copiada a otra tarjeta, con otro código u otra versión, deja de valer.
        assertFalse(PilotCardFormat.verify(PilotCredential(PilotCardFormat.parseHex("a9c6cc11"), 1, token, signature), verificationKey))
        assertFalse(PilotCardFormat.verify(PilotCredential(uid, 1, ByteArray(16), signature), verificationKey))
        assertFalse(PilotCardFormat.verify(PilotCredential(uid, 2, token, signature), verificationKey))
        assertFalse(PilotCardFormat.verify(PilotCredential(uid, 1, token, signature), "no-es-una-clave"))
    }

    @Test
    fun theProofIsUidCodeAndSignature() {
        val signature = ByteArray(64) { 1 }
        val evidence = PilotCredential(uid, 4, token, signature).evidence()
        assertEquals("mifare_classic_signed", evidence.scheme)
        assertEquals(4, evidence.keyVersion)
        val parts = evidence.proof.split('.')
        assertEquals("a9c6cc10", parts[0])
        assertEquals(PilotCardFormat.hex(token), parts[1])
        assertArrayEquals(signature, PilotCardFormat.fromBase64Url(parts[2]))
    }

    @Test
    fun theTrailerKeepsFactoryPermissionsWithTheCompanyKey() {
        val key = PilotCardFormat.parseHex("0102030405a6")
        val trailer = PilotCardFormat.trailer(key)
        assertEquals(16, trailer.size)
        assertArrayEquals(key, trailer.copyOfRange(0, 6))
        assertEquals("ff078069", PilotCardFormat.hex(trailer.copyOfRange(6, 10)))
        assertArrayEquals(key, trailer.copyOfRange(10, 16))
        // Los datos de la credencial nunca tocan el sector 0 ni un bloque final.
        assertEquals(listOf(4, 5, 6, 8, 9, 10), PilotCardFormat.DATA_BLOCKS)
    }
}
