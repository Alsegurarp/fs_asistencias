package mx.fastsolution.zenit.mobile.security

import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class Es256Test {
    @Test
    fun `la conversion conserva la firma de P256 con ceros y bit de signo`() {
        val pair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
        val payload = "evidencia que no cambia".toByteArray()
        repeat(200) {
            val der = Signature.getInstance("SHA256withECDSA").apply { initSign(pair.private); update(payload) }.sign()
            val jose = Es256.joseSignature(der)
            assertEquals(64, jose.size)
            val verifier = Signature.getInstance("SHA256withECDSAinP1363Format").apply { initVerify(pair.public); update(payload) }
            assertTrue(verifier.verify(jose))
        }
    }

    @Test
    fun `rechaza DER truncado negativo no canonico o con basura`() {
        val malformed = listOf(
            byteArrayOf(),
            byteArrayOf(0x30, 6, 2, 1, -1, 2, 1, 1),
            byteArrayOf(0x30, 7, 2, 2, 0, 1, 2, 1, 1),
            byteArrayOf(0x30, 6, 2, 1, 0, 2, 1, 1),
            byteArrayOf(0x30, 6, 2, 1, 1, 2, 1),
            byteArrayOf(0x30, 7, 2, 1, 1, 2, 1, 1, 0),
        )
        malformed.forEach { der -> assertThrows(IllegalArgumentException::class.java) { Es256.joseSignature(der) } }
    }
}
