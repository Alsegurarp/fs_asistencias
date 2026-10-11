package mx.fastsolution.zenit.api

import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Base64
import java.util.UUID

/** Última fila de una página: con ella se pide la siguiente. */
data class PageKey(val at: OffsetDateTime, val id: UUID)

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

    fun encode(key: PageKey): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString("${key.at.toInstant()}|${key.id}".toByteArray())

    /** El cursor es opaco para el cliente; uno alterado se rechaza. */
    fun decode(cursor: String?): PageKey? {
        if (cursor.isNullOrBlank()) return null
        return try {
            val (at, id) = String(Base64.getUrlDecoder().decode(cursor)).split('|', limit = 2)
            PageKey(Instant.parse(at).atOffset(ZoneOffset.UTC), UUID.fromString(id))
        } catch (e: RuntimeException) {
            throw Problems.validation("cursor", "invalid_cursor", "El cursor no es válido.")
        }
    }

    /** Recibe una fila de más para saber si hay página siguiente. */
    fun <R, T> page(rows: List<R>, limit: Int, key: (R) -> PageKey, view: (R) -> T): Page<T> {
        val shown = rows.take(limit)
        val next = if (rows.size > limit) encode(key(shown.last())) else null
        return Page(shown.map(view), next)
    }
}
