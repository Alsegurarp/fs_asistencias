package mx.fastsolution.zenit.api

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class TextSearchTest {
    @Test
    fun `the text is searched by fragment and its wildcards are searched literally`() {
        val checks = Checks()
        assertEquals("%ana%", TextSearch.pattern(checks, "  ana "))
        assertEquals("%50\\%\\_x\\\\%", TextSearch.pattern(checks, "50%_x\\"))
        assertNull(TextSearch.pattern(checks, null))
        assertNull(TextSearch.pattern(checks, "   "))
        checks.done()
    }

    @Test
    fun `a text longer than the limit is a validation error`() {
        val checks = Checks()
        assertNull(TextSearch.pattern(checks, "a".repeat(TextSearch.MAX_LENGTH + 1)))
        assertEquals("validation", assertFailsWith<ApiException> { checks.done() }.code)
        assertEquals("%${"a".repeat(TextSearch.MAX_LENGTH)}%", TextSearch.pattern(Checks(), "a".repeat(TextSearch.MAX_LENGTH)))
    }

    @Test
    fun `the clause repeats the comparison for each expression`() {
        assertEquals(
            " and (search_key(a) like search_key(?) escape '\\' or search_key(b) like search_key(?) escape '\\')",
            TextSearch.clause("a", "b"),
        )
        assertEquals(listOf("%x%", "%x%"), TextSearch.binds("%x%", 2))
    }
}
