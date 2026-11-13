package mx.fastsolution.zenit.tenant

import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.TextSearch
import mx.fastsolution.zenit.capture.CaptureMethods
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.stereotype.Repository
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import java.util.UUID

data class TenantRow(
    val id: UUID,
    val slug: String,
    val name: String,
    val status: String,
    val timeZone: String,
    val weekStartsOn: String,
    /** La política anterior a cualquier cambio programado; la que vale en una fecha la da `BreakPolicies`. */
    val baseBreakPolicy: String,
    val createdAt: OffsetDateTime,
    /** Horas tras el fin de la semana a las que el sistema la cierra; nulo si sólo la cierra una persona. */
    val autoCloseAfterHours: Int? = null,
    /** Las formas de marcar del plan: `card_terminal` y/o `phone_tag`. */
    val captureMethods: List<String> = CaptureMethods.ALL,
    /** La suspensión vigente; nula si está activa o se suspendió antes del contrato 0.37.0. */
    val suspension: TenantSuspension? = null,
)

data class TenantSuspension(val at: OffsetDateTime, val byName: String, val reason: String)

data class TenantUsageCounts(
    val employeesWithAttendance: Int,
    val employeesInPeriod: Int,
    val cardsAssigned: Int,
    val devicesActive: Int,
    val attendanceEvents: Int,
)

/** `text` es el patrón ya escapado de `TextSearch`; `administration`, uno de `ADMINISTRATION_STATES`. */
data class TenantFilter(
    val text: String? = null,
    val status: String? = null,
    val administration: String? = null,
    /** Sólo las que tienen un cambio de comida que todavía no entra. */
    val breakPolicyChange: Boolean = false,
)

/** Una empresa vista desde la operación: con el estado de su administración. */
data class OperatedTenantRow(val tenant: TenantRow, val administration: String)

/** Quien administra una empresa, sin más datos de su persona que su correo y su acceso. */
data class TenantAdministrator(
    val tenantId: UUID,
    val email: String,
    val status: String,
    val invitedAt: OffsetDateTime,
    val linkedAt: OffsetDateTime?,
    /** Cuántas personas administran la empresa, aunque la lista se corte. */
    val total: Int,
)

data class TenantListSummaryView(
    val total: Int,
    val active: Int,
    val suspended: Int,
    val administration: Map<String, Int>,
    /** Las que tienen un cambio de comida que todavía no entra. */
    val breakPolicyChange: Int,
)

/** El uso de una empresa en un mes de su calendario, con los límites con que se cortó. */
data class TenantMonthUsage(
    val tenant: TenantRow,
    val from: OffsetDateTime,
    val to: OffsetDateTime,
    val counts: TenantUsageCounts,
)

data class TenantUsageTotals(
    val tenants: Int,
    val complete: Int,
    val employeesWithAttendance: Long,
    val employeesInPeriod: Long,
    val cardsAssigned: Long,
    val devicesActive: Long,
    val attendanceEvents: Long,
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

    /** Empresas de la más antigua a la más reciente, con los filtros de la consola aplicados antes de paginar. */
    fun page(filter: TenantFilter, after: PageKey?, limit: Int): List<OperatedTenantRow> {
        val binds = mutableListOf<Any?>()
        val sql = StringBuilder("select $T_COLUMNS, $ADMINISTRATION as administration from tenant t")
        sql.append(where(filter, binds))
        if (after != null) {
            sql.append(" and (t.created_at, t.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by t.created_at, t.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map {
            OperatedTenantRow(row(it), it.get("administration", String::class.java))
        }
    }

    /** Conteos de las pestañas de la consola, con la misma búsqueda que la lista. */
    fun summary(text: String?): TenantListSummaryView {
        val binds = mutableListOf<Any?>()
        val r = dsl.fetchOne(
            "select count(*) as total, count(*) filter (where status = 'active') as active, " +
                "count(*) filter (where status = 'suspended') as suspended, " +
                "count(*) filter (where administration = 'linked') as admin_linked, " +
                "count(*) filter (where administration = 'pending') as admin_pending, " +
                "count(*) filter (where administration = 'none') as admin_none, " +
                "count(*) filter (where change) as break_change " +
                "from (select t.status, $ADMINISTRATION as administration, $PENDING_CHANGE as change from tenant t${where(TenantFilter(text), binds)}) s",
            *binds.toTypedArray(),
        )!!
        fun n(column: String) = r.get(column, Number::class.java).toInt()
        return TenantListSummaryView(
            total = n("total"),
            active = n("active"),
            suspended = n("suspended"),
            administration = ADMINISTRATION_STATES.associateWith { n("admin_$it") },
            breakPolicyChange = n("break_change"),
        )
    }

    /**
     * Quienes administran cada empresa de la página, en una sola consulta:
     * primero quien ya entró, de la liga más antigua a la más reciente, y
     * luego las invitaciones, de la más reciente a la más antigua. Hasta
     * `perTenant` por empresa; `total` dice cuántas son.
     */
    fun administrators(ids: Collection<UUID>, perTenant: Int): Map<UUID, List<TenantAdministrator>> {
        if (ids.isEmpty()) return emptyMap()
        return dsl.fetch(
            "select tenant_id, email, status, created_at, linked_at, total from (" +
                "select u.tenant_id, u.email, u.status, u.created_at, u.linked_at, " +
                "count(*) over (partition by u.tenant_id) as total, " +
                "row_number() over (partition by u.tenant_id order by (u.status = 'active') desc, u.linked_at, " +
                "u.created_at desc, u.id) as place " +
                "from tenant_user u join tenant_user_role r on r.tenant_id = u.tenant_id and r.user_id = u.id " +
                "where u.tenant_id = any(?) and r.role = 'admin_empresa' and u.status <> 'disabled') a " +
                "where place <= ? order by tenant_id, place",
            ids.toTypedArray(), perTenant,
        ).map {
            TenantAdministrator(
                tenantId = it.get("tenant_id", UUID::class.java),
                email = it.get("email", String::class.java),
                status = it.get("status", String::class.java),
                invitedAt = it.get("created_at", OffsetDateTime::class.java),
                linkedAt = it.get("linked_at", OffsetDateTime::class.java),
                total = it.get("total", Number::class.java).toInt(),
            )
        }.groupBy { it.tenantId }
    }

    /** Si alguien con el rol de Administración ya entró con su cuenta y conserva el acceso. */
    fun administeredByLinked(id: UUID): Boolean =
        dsl.fetchOne("select 1 as found from tenant t where t.id = ? and $LINKED_ADMIN", id) != null

    /**
     * Un valor nulo deja el campo como estaba. El cierre programado es distinto,
     * porque nulo es un valor suyo: sólo cambia cuando se pide cambiarlo.
     */
    fun update(
        id: UUID,
        name: String?,
        timeZone: String?,
        weekStartsOn: String?,
        changeAutoClose: Boolean,
        autoCloseAfterHours: Int?,
    ): TenantRow? =
        dsl.fetchOne(
            "update tenant set name = coalesce(cast(? as text), name), " +
                "time_zone = coalesce(cast(? as text), time_zone), " +
                "week_starts_on = coalesce(cast(? as text), week_starts_on), " +
                "auto_close_after_hours = case when cast(? as boolean) then cast(? as integer) else auto_close_after_hours end " +
                "where id = ? returning $COLUMNS",
            name, timeZone, weekStartsOn, changeAutoClose, autoCloseAfterHours, id,
        )?.let(::row)

    /** Fija las formas de marcar del plan. */
    fun setCaptureMethods(id: UUID, methods: List<String>): TenantRow? =
        dsl.fetchOne("update tenant set capture_methods = cast(? as text[]) where id = ? returning $COLUMNS", methods.toTypedArray(), id)?.let(::row)

    /** Personas activas de la empresa que marcan de una forma que ya no estaría en el plan. */
    fun peopleOutside(id: UUID, methods: List<String>): Int {
        val person = CaptureMethods.PERSON.filter { CaptureMethods.of(it) !in methods }
        if (person.isEmpty()) return 0
        return dsl.fetchOne(
            "select count(*) from employee where tenant_id = ? and status = 'active' and capture_method = any(cast(? as text[]))",
            id, person.toTypedArray(),
        )!!.get(0, Number::class.java).toInt()
    }

    /** Cambia el estado sólo si estaba en el que se espera; devuelve nulo si no. */
    /** Al suspender guarda cuándo, quién y por qué; al reactivar lo borra. */
    fun setStatus(id: UUID, from: String, to: String, byName: String, reason: String): TenantRow? {
        val suspending = to == "suspended"
        return dsl.fetchOne(
            "update tenant set status = ?, suspended_at = case when ? then statement_timestamp() end, " +
                "suspended_by_name = case when ? then ? end, suspension_reason = case when ? then ? end " +
                "where id = ? and status = ? returning $COLUMNS",
            to, suspending, suspending, byName, suspending, reason, id, from,
        )?.let(::row)
    }

    /** El uso de una empresa en un mes, haya existido o no en él. */
    fun usage(id: UUID, month: YearMonth): TenantMonthUsage =
        monthUsage(month, TenantFilter(), id, null, null).single()

    /**
     * El uso del mes de las empresas que ya existían en él, de la más antigua
     * a la más reciente: los mismos conteos de `usage`, en una consulta por
     * página.
     */
    fun usagePage(month: YearMonth, filter: TenantFilter, after: PageKey?, limit: Int): List<TenantMonthUsage> =
        monthUsage(month, filter, null, after, limit)

    /** Los totales de `usagePage` con esos filtros, sin paginar. */
    fun usageTotals(month: YearMonth, filter: TenantFilter): TenantUsageTotals {
        val binds = mutableListOf<Any?>()
        val r = dsl.fetchOne(
            "${monthScope(month, filter, null, null, null, binds)} select count(*) as tenants, " +
                "count(*) filter (where p.month_to <= now()) as complete, " +
                "coalesce(sum(marked.people), 0) as people_marking, coalesce(sum(marked.marks), 0) as marks, " +
                "coalesce(sum(employed.people), 0) as people_employed, coalesce(sum(carded.cards), 0) as cards, " +
                "coalesce(sum(enrolled.devices), 0) as devices from p ${counts(month, binds)}",
            *binds.toTypedArray(),
        )!!
        fun n(column: String) = r.get(column, Number::class.java).toLong()
        return TenantUsageTotals(
            tenants = n("tenants").toInt(),
            complete = n("complete").toInt(),
            employeesWithAttendance = n("people_marking"),
            employeesInPeriod = n("people_employed"),
            cardsAssigned = n("cards"),
            devicesActive = n("devices"),
            attendanceEvents = n("marks"),
        )
    }

    private fun monthUsage(month: YearMonth, filter: TenantFilter, id: UUID?, after: PageKey?, limit: Int?): List<TenantMonthUsage> {
        val binds = mutableListOf<Any?>()
        val sql = "${monthScope(month, filter, id, after, limit, binds)} select p.*, marked.people as people_marking, " +
            "marked.marks, employed.people as people_employed, carded.cards, enrolled.devices " +
            "from p ${counts(month, binds)} order by p.created_at, p.id"
        return dsl.fetch(sql, *binds.toTypedArray()).map {
            fun count(column: String) = it.get(column, Number::class.java).toInt()
            TenantMonthUsage(
                tenant = row(it),
                from = it.get("month_from", OffsetDateTime::class.java),
                to = it.get("month_to", OffsetDateTime::class.java),
                counts = TenantUsageCounts(
                    employeesWithAttendance = count("people_marking"),
                    employeesInPeriod = count("people_employed"),
                    cardsAssigned = count("cards"),
                    devicesActive = count("devices"),
                    attendanceEvents = count("marks"),
                ),
            )
        }
    }

    /**
     * Las empresas `p` con el inicio de su mes y del siguiente en su propia
     * zona. Sin `id`, sólo las que ya existían antes de que el mes terminara.
     */
    private fun monthScope(
        month: YearMonth,
        filter: TenantFilter,
        id: UUID?,
        after: PageKey?,
        limit: Int?,
        binds: MutableList<Any?>,
    ): String {
        val next = month.plusMonths(1)
        binds.addAll(listOf(month.year, month.monthValue, next.year, next.monthValue))
        val sql = StringBuilder(
            "with b as (select $T_COLUMNS, make_timestamptz(?, ?, 1, 0, 0, 0, t.time_zone) as month_from, " +
                "make_timestamptz(?, ?, 1, 0, 0, 0, t.time_zone) as month_to from tenant t",
        )
        sql.append(where(filter, binds))
        if (id != null) {
            sql.append(" and t.id = ?")
            binds += id
        }
        sql.append("), p as (select * from b where ")
        sql.append(if (id == null) "created_at < month_to" else "true")
        if (after != null) {
            sql.append(" and (created_at, id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        if (limit != null) {
            sql.append(" order by created_at, id limit ?")
            binds += limit
        }
        return sql.append(")").toString()
    }

    /**
     * Conteos de uso de cada empresa `p` en su mes, para facturar. Cada uno
     * se apoya en datos que guardan su historia: marcajes, vigencia laboral,
     * asignaciones de tarjeta y activación o revocación de dispositivos. Es
     * la única definición de cada conteo.
     */
    private fun counts(month: YearMonth, binds: MutableList<Any?>): String {
        binds += month.atEndOfMonth().toString()
        binds += month.atDay(1).toString()
        return "cross join lateral (select count(distinct x.employee_id) as people, count(*) as marks from attendance_event x " +
            "where x.tenant_id = p.id and x.observed_at >= p.month_from and x.observed_at < p.month_to) marked " +
            "cross join lateral (select count(*) as people from employee x where x.tenant_id = p.id " +
            "and x.employment_start <= cast(? as date) and (x.employment_end is null or x.employment_end >= cast(? as date))) employed " +
            "cross join lateral (select count(distinct x.card_id) as cards from card_assignment x where x.tenant_id = p.id " +
            "and x.since < p.month_to and (x.until is null or x.until > p.month_from)) carded " +
            "cross join lateral (select count(*) as devices from device x where x.tenant_id = p.id " +
            "and x.enrolled_at < p.month_to and (x.revoked_at is null or x.revoked_at > p.month_from)) enrolled"
    }

    private fun where(filter: TenantFilter, binds: MutableList<Any?>): String {
        val sql = StringBuilder(" where true")
        filter.text?.let {
            sql.append(TextSearch.clause("t.name", "t.slug"))
            binds.addAll(TextSearch.binds(it, 2))
        }
        filter.status?.let {
            sql.append(" and t.status = ?")
            binds += it
        }
        filter.administration?.let {
            sql.append(" and $ADMINISTRATION = ?")
            binds += it
        }
        if (filter.breakPolicyChange) sql.append(" and $PENDING_CHANGE")
        return sql.toString()
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
        baseBreakPolicy = r.get("break_policy", String::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        autoCloseAfterHours = r.get("auto_close_after_hours", Number::class.java)?.toInt(),
        captureMethods = r.get("capture_methods", Array<String>::class.java).toList(),
        suspension = r.get("suspended_at", OffsetDateTime::class.java)?.let {
            TenantSuspension(it, r.get("suspended_by_name", String::class.java), r.get("suspension_reason", String::class.java))
        },
    )

    companion object {
        /** Ya entró: alguien con Administración entró con su cuenta y conserva el acceso. Pendiente: sólo invitaciones. Nadie: ninguna de las dos. */
        val ADMINISTRATION_STATES = listOf("linked", "pending", "none")

        private const val COLUMNS = "id, slug, name, status, time_zone, week_starts_on, break_policy, created_at, auto_close_after_hours, capture_methods, " +
            "suspended_at, suspended_by_name, suspension_reason"
        private const val T_COLUMNS =
            "t.id, t.slug, t.name, t.status, t.time_zone, t.week_starts_on, t.break_policy, t.created_at, t.auto_close_after_hours, t.capture_methods, " +
                "t.suspended_at, t.suspended_by_name, t.suspension_reason"

        /** Alguien de la empresa `t` con el rol de Administración y la condición que sigue. */
        private const val ADMIN_OF_T =
            "exists (select 1 from tenant_user u join tenant_user_role r on r.tenant_id = u.tenant_id and r.user_id = u.id " +
                "where u.tenant_id = t.id and r.role = 'admin_empresa' and "

        /** `active` sólo lo tiene quien está ligada a una cuenta: al soltar la liga vuelve a `invited`. */
        private const val LINKED_ADMIN = "$ADMIN_OF_T u.status = 'active')"

        /** La empresa `t` tiene un cambio de comida que todavía no entra en su calendario. */
        private const val PENDING_CHANGE =
            "exists (select 1 from break_policy_change c where c.tenant_id = t.id and c.cancelled_at is null " +
                "and c.effective_on > cast(statement_timestamp() at time zone t.time_zone as date))"

        private const val ADMINISTRATION =
            "(case when $LINKED_ADMIN then 'linked' when $ADMIN_OF_T u.status = 'invited') then 'pending' else 'none' end)"
    }
}
