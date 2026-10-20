package mx.fastsolution.zenit.mobile

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class CardCredentialFormatTest {
    @Test fun `preserves utf8 employee data and clears trailing bytes on replacement`() {
        val long = CardCredentialFormat.encode("Mariana Torres Hernández, Coordinadora de operaciones")
        val short = CardCredentialFormat.encode("EJ-002")
        assertEquals("Mariana Torres Hernández, Coordinadora de operaciones", CardCredentialFormat.decode(long))
        assertEquals("EJ-002", CardCredentialFormat.decode(short))
        assertTrue(short.drop(22).all { it == 0.toByte() })
    }
    @Test fun `never targets manufacturer block or sector trailers`() {
        assertEquals(24, CardCredentialFormat.blocks.size)
        assertEquals(CardCredentialFormat.capacity, CardCredentialFormat.blocks.size * 16)
        assertTrue(CardCredentialFormat.blocks.all { it >= 4 && it <= 34 && it % 4 != 3 })
        assertEquals(CardCredentialFormat.blocks.size, CardCredentialFormat.blocks.distinct().size)
    }
    @Test fun `rejects damaged payload and incomplete headers`() {
        val bytes = CardCredentialFormat.encode("EJ-001")
        bytes[16] = (bytes[16].toInt() xor 1).toByte()
        assertThrows(IllegalArgumentException::class.java) { CardCredentialFormat.decode(bytes) }
        val pending = CardCredentialFormat.pendingHeader.copyOf(CardCredentialFormat.capacity)
        assertTrue(CardCredentialFormat.canReplace(pending))
        assertThrows(IllegalArgumentException::class.java) { CardCredentialFormat.decode(pending) }
    }
    @Test fun `refuses unknown data and validates byte capacity before writing`() {
        assertFalse(CardCredentialFormat.canReplace(ByteArray(CardCredentialFormat.capacity) { 42 }))
        assertTrue(CardCredentialFormat.canReplace(ByteArray(CardCredentialFormat.capacity)))
        assertTrue(CardCredentialFormat.canReplace(CardCredentialFormat.encode("EJ-001")))
        assertThrows(IllegalArgumentException::class.java) { CardCredentialFormat.encode("é".repeat(185)) }
        assertThrows(IllegalArgumentException::class.java) { CardCredentialFormat.encode("") }
        assertEquals("a".repeat(368), CardCredentialFormat.decode(CardCredentialFormat.encode("a".repeat(368))))
    }
}