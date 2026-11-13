package mx.fastsolution.zenit.site

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.capture.CaptureMethods
import mx.fastsolution.zenit.tenant.TenantRepository
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.SiteScope
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime
import java.util.UUID

data class SiteRow(
    val id: UUID,
    val name: String,
    val timeZone: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Int,
    val status: String,
    val createdAt: OffsetDateTime,
    /** Personas activas de la sede. */
    val people: Int = 0,
    /** Terminales activas de la sede. */
    val terminals: Int = 0,
    /** Las formas de marcar que admite la sede; nulo es todo lo del plan. */
    val captureMethods: List<String>? = null,
)

/** Sirve para crear y para cambiar: al cambiar, lo que no viene se queda igual. */
class SiteRequest {
    var name: String? = null
    var timeZone: String? = null
    var latitude: Double? = null
    var longitude: Double? = null
    var radiusMeters: Int? = null
    var status: String? = null
    /** Sólo al cambiar: dentro de lo que trae el plan. */
    var captureMethods: List<Any?>? = null
}

data class SiteView(
    val id: String,
    val name: String,
    val timeZone: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Int,
    val status: String,
    val createdAt: String,
    val people: Int,
    val terminals: Int,
    /** Lo que la sede admite, dentro del plan. Sin elección de la sede, todo el plan. */
    val captureMethods: List<String>,
) {
    companion object {
        fun of(row: SiteRow, plan: List<String>) = SiteView(
            row.id.toString(), row.name, row.timeZone, row.latitude, row.longitude, row.radiusMeters, row.status,
            row.createdAt.toInstant().toString(), row.people, row.terminals, CaptureMethods.effective(plan, row.captureMethods),
        )
    }
}

@Repository
class SiteRepository(private val dsl: DSLContext) {
    fun insert(tenantId: UUID, id: UUID, name: String, timeZone: String, latitude: Double, longitude: Double, radius: Int) {
        dsl.execute(
            "insert into site (tenant_id, id, name, time_zone, latitude, longitude, radius_m, status) " +
                "values (?, ?, ?, ?, cast(? as numeric), cast(? as numeric), ?, 'active')",
            tenantId, id, name, timeZone, latitude, longitude, radius,
        )
    }

    /** Identificador y nombre de las sedes indicadas de esa empresa, por nombre. */
    fun names(tenantId: UUID, ids: Collection<UUID>): List<Pair<UUID, String>> {
        if (ids.isEmpty()) return emptyList()
        return dsl.fetch("select id, name from site where tenant_id = ? and id = any(?) order by name, id", tenantId, ids.toTypedArray())
            .map { it.get("id", UUID::class.java) to it.get("name", String::class.java) }
    }

    fun find(tenantId: UUID, id: UUID): SiteRow? =
        dsl.fetchOne("select $COLUMNS from site where tenant_id = ? and id = ?${SiteScope.clause("id")}", tenantId, id)?.let(::row)

    fun page(tenantId: UUID, after: PageKey?, limit: Int): List<SiteRow> {
        val rows = if (after == null) {
            dsl.fetch("select $COLUMNS from site where tenant_id = ?${SiteScope.clause("id")} order by created_at, id limit ?", tenantId, limit)
        } else {
            dsl.fetch(
                "select $COLUMNS from site where tenant_id = ?${SiteScope.clause("id")} and (created_at, id) > " +
                    "(cast(? as timestamptz), cast(? as uuid)) order by created_at, id limit ?",
                tenantId, after.at, after.id, limit,
            )
        }
        return rows.map { row(it) }
    }

    /** Sedes activas con ese nombre, sin distinguir mayúsculas. */
    fun activeByName(tenantId: UUID, name: String): List<UUID> =
        dsl.fetch(
            "select id from site where tenant_id = ? and status = 'active' and lower(name) = lower(?)", tenantId, name,
        ).map { it.get("id", UUID::class.java) }

    /**
     * Las cifras de esas sedes para el API: personas activas y terminales
     * activas, de índices parciales (V021). Van aparte de `find` y `page`, que
     * también usan la captura y el expediente y no deben leer más tablas.
     */
    fun withCounts(tenantId: UUID, rows: List<SiteRow>): List<SiteRow> {
        if (rows.isEmpty()) return rows
        val ids = rows.map { it.id }.toTypedArray()
        fun counted(sql: String): Map<UUID, Int> =
            dsl.fetch(sql, tenantId, ids).associate { it.get("site_id", UUID::class.java) to it.get("n", Number::class.java).toInt() }
        val people = counted(
            "select site_id, count(*) as n from employee where tenant_id = ? and site_id = any(?) and status = 'active' group by site_id",
        )
        val terminals = counted(
            "select site_id, count(*) as n from device where tenant_id = ? and site_id = any(?) " +
                "and mode = 'terminal' and status = 'active' group by site_id",
        )
        return rows.map { it.copy(people = people[it.id] ?: 0, terminals = terminals[it.id] ?: 0) }
    }

    fun update(tenantId: UUID, id: UUID, r: SiteRow) {
        dsl.execute(
            "update site set name = ?, time_zone = ?, latitude = cast(? as numeric), longitude = cast(? as numeric), " +
                "radius_m = ?, status = ?, capture_methods = cast(? as text[]) where tenant_id = ? and id = ?",
            r.name, r.timeZone, r.latitude, r.longitude, r.radiusMeters, r.status, r.captureMethods?.toTypedArray(), tenantId, id,
        )
    }

    private fun row(r: Record) = SiteRow(
        id = r.get("id", UUID::class.java),
        name = r.get("name", String::class.java),
        timeZone = r.get("time_zone", String::class.java),
        latitude = r.get("latitude", Number::class.java).toDouble(),
        longitude = r.get("longitude", Number::class.java).toDouble(),
        radiusMeters = r.get("radius_m", Number::class.java).toInt(),
        status = r.get("status", String::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        captureMethods = r.get("capture_methods", Array<String>::class.java)?.toList(),
    )

    private companion object {
        const val COLUMNS = "id, name, time_zone, latitude, longitude, radius_m, status, created_at, capture_methods"
    }
}

@Service
class SiteService(private val sites: SiteRepository, private val tenants: TenantRepository, private val audit: AuditLog) {
    /** Las formas de marcar del plan de la empresa. */
    fun plan(person: CurrentPerson): List<String> = tenants.find(person.requireTenant())!!.captureMethods

    @Transactional
    fun create(person: CurrentPerson, request: SiteRequest): SiteRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val name = checks.text("name", request.name, MAX_NAME, required = true)
        val timeZone = checks.timeZone("timeZone", request.timeZone, required = true)
        val latitude = checks.decimal("latitude", request.latitude, -90.0, 90.0, required = true)
        val longitude = checks.decimal("longitude", request.longitude, -180.0, 180.0, required = true)
        val radius = checks.whole("radiusMeters", request.radiusMeters, MIN_RADIUS, MAX_RADIUS, required = true)
        // Una sede nace activa y con todo el plan; el estado y las formas sólo se cambian después.
        if (request.status != null) checks.fail("status", "not_allowed", "No se da al crear la sede.")
        if (request.captureMethods != null) checks.fail("captureMethods", "not_allowed", "No se da al crear la sede.")
        checks.done()

        val id = UUID.randomUUID()
        sites.insert(tenantId, id, name!!, timeZone!!, latitude!!, longitude!!, radius!!)
        audit.record(tenantId, person, "site.created", "site", id)
        // Recién creada no tiene personas ni terminales: no hace falta contarlas.
        return sites.find(tenantId, id)!!
    }

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, after: PageKey?, limit: Int): List<SiteRow> {
        val tenantId = person.requireTenant()
        return sites.withCounts(tenantId, sites.page(tenantId, after, limit + 1))
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): SiteRow {
        val tenantId = person.requireTenant()
        return sites.withCounts(tenantId, listOf(sites.find(tenantId, id) ?: throw Problems.notFound())).single()
    }

    @Transactional
    fun update(person: CurrentPerson, id: UUID, request: SiteRequest): SiteRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val name = checks.text("name", request.name, MAX_NAME, required = false)
        val timeZone = checks.timeZone("timeZone", request.timeZone, required = false)
        val latitude = checks.decimal("latitude", request.latitude, -90.0, 90.0, required = false)
        val longitude = checks.decimal("longitude", request.longitude, -180.0, 180.0, required = false)
        val radius = checks.whole("radiusMeters", request.radiusMeters, MIN_RADIUS, MAX_RADIUS, required = false)
        val status = checks.oneOf("status", request.status, STATUSES, required = false)
        val methods = CaptureMethods.parse(checks, "captureMethods", request.captureMethods, required = false)
        val plan = tenants.find(tenantId)!!.captureMethods
        if (methods != null && methods.any { it !in plan }) {
            checks.fail("captureMethods", "not_in_plan", "El plan de la empresa no trae esa forma de marcar.")
        }
        val changed = listOfNotNull(
            name?.let { "name" }, timeZone?.let { "timeZone" }, latitude?.let { "latitude" },
            longitude?.let { "longitude" }, radius?.let { "radiusMeters" }, status?.let { "status" },
            methods?.let { "captureMethods" },
        )
        if (changed.isEmpty()) checks.fail("", "empty_update", "Hay que cambiar al menos un campo.")
        checks.done()

        val before = sites.find(tenantId, id) ?: throw Problems.notFound()
        sites.update(
            tenantId, id,
            before.copy(
                name = name ?: before.name,
                timeZone = timeZone ?: before.timeZone,
                latitude = latitude ?: before.latitude,
                longitude = longitude ?: before.longitude,
                radiusMeters = radius ?: before.radiusMeters,
                status = status ?: before.status,
                // Todo lo del plan se guarda como nulo: si el plan crece, la sede lo admite también.
                captureMethods = if (methods == null) before.captureMethods else methods.takeIf { it != plan },
            ),
        )
        audit.record(tenantId, person, "site.updated", "site", id, mapOf("fields" to changed.joinToString(",")))
        return sites.withCounts(tenantId, listOf(sites.find(tenantId, id)!!)).single()
    }

    private companion object {
        const val MAX_NAME = 120
        const val MIN_RADIUS = 20
        const val MAX_RADIUS = 2000
        val STATUSES = setOf("active", "inactive")
    }
}

@RestController
@RequestMapping("/api/v1/sites")
class SiteController(private val service: SiteService) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<SiteView> {
        val size = Paging.limit(limit)
        val plan = service.plan(person)
        return Paging.page(service.page(person, Paging.decode(cursor), size), size, { PageKey(it.createdAt, it.id) }) { SiteView.of(it, plan) }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: SiteRequest): SiteView =
        SiteView.of(service.create(person, request), service.plan(person))

    @GetMapping("/{siteId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable siteId: UUID): SiteView =
        SiteView.of(service.get(person, siteId), service.plan(person))

    @PatchMapping("/{siteId}")
    fun update(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable siteId: UUID,
        @RequestBody request: SiteRequest,
    ): SiteView = SiteView.of(service.update(person, siteId, request), service.plan(person))
}
