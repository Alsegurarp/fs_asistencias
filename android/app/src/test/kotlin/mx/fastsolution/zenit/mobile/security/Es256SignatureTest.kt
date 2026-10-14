package mx.fastsolution.zenit.mobile.security

import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class Es256SignatureTest {
    @Test
    fun `converts real P256 signatures without changing their integers`() {
        val pair = KeyPairGenerator.getInstance("EC").apply {
            initialize(ECGenParameterSpec("secp256r1"))
        }.generateKeyPair()
        repeat(32) {
            val signer = Signature.getInstance("SHA256withECDSA").apply { initSign(pair.private) }
            signer.update("activation proof".toByteArray())
            val der = signer.sign()
            val jose = Es256Signature.fromDer(der)
            assertEquals(64, jose.size)
            val r = BigInteger(1, jose.copyOfRange(0, 32)).toByteArray()
            val s = BigInteger(1, jose.copyOfRange(32, 64)).toByteArray()
            val reconstructed = byteArrayOf(0x30, (4 + r.size + s.size).toByte(), 0x02, r.size.toByte()) +
                r + byteArrayOf(0x02, s.size.toByte()) + s
            assertArrayEquals(der, reconstructed)
        }
    }

    @Test
    fun `pads short positive integers`() {
        val result = Es256Signature.fromDer(byteArrayOf(0x30, 6, 2, 1, 1, 2, 1, 2))
        assertEquals(1.toByte(), result[31])
        assertEquals(2.toByte(), result[63])
        assertEquals(2, result.count { it != 0.toByte() })
    }

    @Test
    fun `rejects truncated negative and trailing signature data`() {
        listOf(
            byteArrayOf(),
            byteArrayOf(0x30, 6, 2, 1, -1, 2, 1, 2),
            byteArrayOf(0x30, 6, 2, 1, 1),
            byteArrayOf(0x30, 7, 2, 1, 1, 2, 1, 2, 0),
        ).forEach { malformed ->
            assertThrows(IllegalArgumentException::class.java) { Es256Signature.fromDer(malformed) }
        }
    }
}
