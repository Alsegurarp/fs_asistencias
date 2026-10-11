package mx.fastsolution.zenit.tenant

import mx.fastsolution.zenit.api.PageKey
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime
import java.util.UUID

data class TenantRow(
    val id: UUID,
    val slug: String,
    val name: String,
    val status: String,
    val timeZone: String,
    val weekStartsOn: String,
    val breakPolicy: String,
    val createdAt: OffsetDateTime,
)

@Repository
class TenantRepository(private val dsl: DSLContext) {
    fun insert(id: UUID, slug: String, name: String, timeZone: String, weekStartsOn: String, breakPolicy: String): TenantRow =
        row(
            dsl.fetchOne(
                "insert into tenant (id, slug, name, status, time_zone, week_starts_on, break_policy) " +
                    "values (?, ?, ?, 'active', ?, ?, ?) returning $COLUMNS",
                id, slug, name, timeZone, weekStartsOn, breakPolicy,
            )!!,
        )

    fun find(id: UUID): TenantRow? = dsl.fetchOne("select $COLUMNS from tenant where id = ?", id)?.let(::row)

    /** Pone en fila los cambios de una misma empresa que dependen unos de otros. */
    fun lock(id: UUID) {
        dsl.fetchOne("select id from tenant where id = ? for update", id)
    }

    fun page(after: PageKey?, limit: Int): List<TenantRow> {
        val rows = if (after == null) {
            dsl.fetch("select $COLUMNS from tenant order by created_at, id limit ?", limit)
        } else {
            dsl.fetch(
                "select $COLUMNS from tenant where (created_at, id) > (cast(? as timestamptz), cast(? as uuid)) " +
                    "order by created_at, id limit ?",
                after.at, after.id, limit,
            )
        }
        return rows.map { row(it) }
    }

    /** Un valor nulo deja el campo como estaba. */
    fun update(id: UUID, name: String?, timeZone: String?, weekStartsOn: String?, breakPolicy: String?): TenantRow? =
        dsl.fetchOne(
            "update tenant set name = coalesce(cast(? as text), name), " +
                "time_zone = coalesce(cast(? as text), time_zone), " +
                "week_starts_on = coalesce(cast(? as text), week_starts_on), " +
                "break_policy = coalesce(cast(? as text), break_policy) " +
                "where id = ? returning $COLUMNS",
            name, timeZone, weekStartsOn, breakPolicy, id,
        )?.let(::row)

    private fun row(r: Record) = TenantRow(
        id = r.get("id", UUID::class.java),
        slug = r.get("slug", String::class.java),
        name = r.get("name", String::class.java),
        status = r.get("status", String::class.java),
        timeZone = r.get("time_zone", String::class.java),
        weekStartsOn = r.get("week_starts_on", String::class.java),
        breakPolicy = r.get("break_policy", String::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
    )

    private companion object {
        const val COLUMNS = "id, slug, name, status, time_zone, week_starts_on, break_policy, created_at"
    }
}
