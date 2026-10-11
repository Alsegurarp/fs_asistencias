package mx.fastsolution.jornada.mobile.capture

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class TagEvidenceHasherTest {
    @Test
    fun `genera evidencia estable sin conservar el uid en claro`() {
        val rawTagId = byteArrayOf(0x01, 0x23, 0x45, 0x67)

        val first = TagEvidenceHasher.sha256(rawTagId)
        val second = TagEvidenceHasher.sha256(rawTagId)

        assertEquals(first, second)
        assertEquals(64, first.length)
        assertNotEquals("01234567", first)
    }

    @Test
    fun `rechaza identificadores vacios`() {
        assertThrows(IllegalArgumentException::class.java) {
            TagEvidenceHasher.sha256(byteArrayOf())
        }
    }
}

