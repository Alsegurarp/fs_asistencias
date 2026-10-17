package mx.fastsolution.zenit.api

import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.OperatorProperties
import mx.fastsolution.zenit.identity.TokenIdentity
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PagingTest {
    @Test
    fun `a cursor comes back as the same key, down to the microsecond`() {
        val key = PageKey(OffsetDateTime.parse("2026-10-05T15:00:00.123456Z"), UUID.randomUUID())

        assertEquals(key, Paging.decode(Paging.encode(key)))
        assertNull(Paging.decode(null))
        assertNull(Paging.decode(""))
    }

    @Test
    fun `a tampered cursor or an out of range limit is a validation error`() {
        assertEquals("validation", assertFailsWith<ApiException> { Paging.decode("no-es-un-cursor") }.code)
        assertEquals("validation", assertFailsWith<ApiException> { Paging.limit("0") }.code)
        assertEquals("validation", assertFailsWith<ApiException> { Paging.limit("201") }.code)
        assertEquals("validation", assertFailsWith<ApiException> { Paging.limit("muchos") }.code)
        assertEquals(Paging.DEFAULT_LIMIT, Paging.limit(null))
        assertEquals(200, Paging.limit("200"))
    }

    @Test
    fun `a page announces the next one only when there are more rows`() {
        val key = { n: Int -> PageKey(OffsetDateTime.parse("2026-10-05T15:00:00Z").plusSeconds(n.toLong()), UUID(0, n.toLong())) }

        val full = Paging.page(listOf(1, 2, 3), 2, key) { it }
        assertEquals(listOf(1, 2), full.items)
        assertEquals(key(2), Paging.decode(full.nextCursor))

        val last = Paging.page(listOf(1, 2), 2, key) { it }
        assertEquals(listOf(1, 2), last.items)
        assertNull(last.nextCursor)
    }
}

class OperatorPropertiesTest {
    @Test
    fun `operators are matched by email, whatever the case and the separator`() {
        val operators = OperatorProperties("Operadora@zenit.invalid\n  segundo@zenit.invalid ,tercera@zenit.invalid\n")

        assertEquals(3, operators.count)
        assertTrue(operators.isOperator("operadora@ZENIT.invalid"))
        assertTrue(operators.isOperator(" segundo@zenit.invalid "))
        assertFalse(operators.isOperator("otra@zenit.invalid"))
    }

    @Test
    fun `without a list nobody operates`() {
        assertEquals(0, OperatorProperties(null).count)
        assertEquals(0, OperatorProperties(" \n").count)
        assertFalse(OperatorProperties("").isOperator(""))
    }
}

class TokenIdentityTest {
    @Test
    fun `only a verified email identifies someone`() {
        assertEquals("persona@zenit.invalid", TokenIdentity("s", " Persona@Zenit.invalid ", true, "").verifiedEmail)
        assertNull(TokenIdentity("s", "persona@zenit.invalid", false, "").verifiedEmail)
        assertNull(TokenIdentity("s", null, true, "").verifiedEmail)
        assertNull(TokenIdentity("s", " ", true, "").verifiedEmail)
    }
}

class AuditJsonTest {
    @Test
    fun `metadata is written as a json object of text`() {
        assertEquals("{}", AuditLog.json(emptyMap()))
        assertEquals(
            "{\"roles\":\"rh,supervisor\",\"nota\":\"dice \\\"hola\\\" \\\\ y salta\\u000a\"}",
            AuditLog.json(linkedMapOf("roles" to "rh,supervisor", "nota" to "dice \"hola\" \\ y salta\n")),
        )
    }
}
