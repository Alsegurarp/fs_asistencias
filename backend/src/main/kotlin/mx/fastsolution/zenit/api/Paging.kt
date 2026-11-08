package mx.fastsolution.zenit.api

import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Base64
import java.util.UUID

/**
 * Última fila de una página: con ella se pide la siguiente. `rank` sólo va en
 * las listas que ordenan primero por una categoría, como la severidad.
 */
data class PageKey(val at: OffsetDateTime, val id: UUID, val rank: Int? = null)

data class Page<T>(val items: List<T>, val nextCursor: String?)

object Paging {
    const val DEFAULT_LIMIT = 50
    const val MAX_LIMIT = 200

    fun limit(raw: String?): Int {
        if (raw.isNullOrBlank()) return DEFAULT_LIMIT
        val value = raw.toIntOrNull()
        if (value == null || value < 1 || value > MAX_LIMIT) {
            throw Problems.validation("limit", "out_of_range", "Debe estar entre 1 y $MAX_LIMIT.")
        }
        return value
    }

    fun encode(key: PageKey): String {
        val text = "${key.at.toInstant()}|${key.id}" + (key.rank?.let { "|$it" } ?: "")
        return Base64.getUrlEncoder().withoutPadding().encodeToString(text.toByteArray())
    }

    /** El cursor es opaco para el cliente; uno alterado se rechaza. */
    fun decode(cursor: String?): PageKey? {
        if (cursor.isNullOrBlank()) return null
        return try {
            val parts = String(Base64.getUrlDecoder().decode(cursor)).split('|')
            require(parts.size in 2..3)
            PageKey(Instant.parse(parts[0]).atOffset(ZoneOffset.UTC), UUID.fromString(parts[1]), parts.getOrNull(2)?.toInt())
        } catch (e: RuntimeException) {
            throw invalidCursor()
        }
    }

    /** Un cursor de otro orden daría una página equivocada: se rechaza igual que uno alterado. */
    fun invalidCursor() = Problems.validation("cursor", "invalid_cursor", "El cursor no es válido.")

    /** Recibe una fila de más para saber si hay página siguiente. */
    fun <R, T> page(rows: List<R>, limit: Int, key: (R) -> PageKey, view: (R) -> T): Page<T> {
        val shown = rows.take(limit)
        val next = if (rows.size > limit) encode(key(shown.last())) else null
        return Page(shown.map(view), next)
    }
}
