package mx.fastsolution.zenit.tenant

import mx.fastsolution.zenit.api.PageKey
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.stereotype.Repository
import java.time.LocalDate
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
    /** Horas tras el fin de la semana a las que el sistema la cierra; nulo si sólo la cierra una persona. */
    val autoCloseAfterHours: Int? = null,
)

data class TenantUsageCounts(
    val employeesWithAttendance: Int,
    val employeesInPeriod: Int,
    val cardsAssigned: Int,
    val devicesActive: Int,
    val attendanceEvents: Int,
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

    /**
     * Un valor nulo deja el campo como estaba. El cierre programado es distinto,
     * porque nulo es un valor suyo: sólo cambia cuando se pide cambiarlo.
     */
    fun update(
        id: UUID,
        name: String?,
        timeZone: String?,
        weekStartsOn: String?,
        breakPolicy: String?,
        changeAutoClose: Boolean,
        autoCloseAfterHours: Int?,
    ): TenantRow? =
        dsl.fetchOne(
            "update tenant set name = coalesce(cast(? as text), name), " +
                "time_zone = coalesce(cast(? as text), time_zone), " +
                "week_starts_on = coalesce(cast(? as text), week_starts_on), " +
                "break_policy = coalesce(cast(? as text), break_policy), " +
                "auto_close_after_hours = case when cast(? as boolean) then cast(? as integer) else auto_close_after_hours end " +
                "where id = ? returning $COLUMNS",
            name, timeZone, weekStartsOn, breakPolicy, changeAutoClose, autoCloseAfterHours, id,
        )?.let(::row)

    /** Cambia el estado sólo si estaba en el que se espera; devuelve nulo si no. */
    fun setStatus(id: UUID, from: String, to: String): TenantRow? =
        dsl.fetchOne("update tenant set status = ? where id = ? and status = ? returning $COLUMNS", to, id, from)?.let(::row)

    /**
     * Conteos de uso entre dos instantes, para facturar. Cada uno se apoya en
     * datos que guardan su historia: marcajes, vigencia laboral, asignaciones
     * de tarjeta y activación o revocación de dispositivos.
     */
    fun usage(id: UUID, from: OffsetDateTime, to: OffsetDateTime, firstDay: LocalDate, lastDay: LocalDate): TenantUsageCounts {
        val r = dsl.fetchOne(
            "select " +
                "(select count(distinct employee_id) from attendance_event where tenant_id = ? " +
                "and observed_at >= cast(? as timestamptz) and observed_at < cast(? as timestamptz)) as people_marking, " +
                "(select count(*) from attendance_event where tenant_id = ? " +
                "and observed_at >= cast(? as timestamptz) and observed_at < cast(? as timestamptz)) as marks, " +
                "(select count(*) from employee where tenant_id = ? and employment_start <= cast(? as date) " +
                "and (employment_end is null or employment_end >= cast(? as date))) as people_employed, " +
                "(select count(distinct card_id) from card_assignment where tenant_id = ? " +
                "and since < cast(? as timestamptz) and (until is null or until > cast(? as timestamptz))) as cards, " +
                "(select count(*) from device where tenant_id = ? " +
                "and enrolled_at < cast(? as timestamptz) and (revoked_at is null or revoked_at > cast(? as timestamptz))) as devices",
            id, from, to,
            id, from, to,
            id, lastDay.toString(), firstDay.toString(),
            id, to, from,
            id, to, from,
        )!!
        fun count(column: String) = r.get(column, Number::class.java).toInt()
        return TenantUsageCounts(
            employeesWithAttendance = count("people_marking"),
            employeesInPeriod = count("people_employed"),
            cardsAssigned = count("cards"),
            devicesActive = count("devices"),
            attendanceEvents = count("marks"),
        )
    }

    /** Empresas activas que pidieron que sus semanas se cierren solas. */
    fun autoClosing(): List<TenantRow> =
        dsl.fetch("select $COLUMNS from tenant where status = 'active' and auto_close_after_hours is not null order by created_at, id")
            .map { row(it) }

    private fun row(r: Record) = TenantRow(
        id = r.get("id", UUID::class.java),
        slug = r.get("slug", String::class.java),
        name = r.get("name", String::class.java),
        status = r.get("status", String::class.java),
        timeZone = r.get("time_zone", String::class.java),
        weekStartsOn = r.get("week_starts_on", String::class.java),
        breakPolicy = r.get("break_policy", String::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        autoCloseAfterHours = r.get("auto_close_after_hours", Number::class.java)?.toInt(),
    )

    private companion object {
        const val COLUMNS = "id, slug, name, status, time_zone, week_starts_on, break_policy, created_at, auto_close_after_hours"
    }
}
