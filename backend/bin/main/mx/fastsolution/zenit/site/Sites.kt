package mx.fastsolution.zenit.site

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
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
)

/** Sirve para crear y para cambiar: al cambiar, lo que no viene se queda igual. */
class SiteRequest {
    var name: String? = null
    var timeZone: String? = null
    var latitude: Double? = null
    var longitude: Double? = null
    var radiusMeters: Int? = null
    var status: String? = null
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
) {
    companion object {
        fun of(row: SiteRow) = SiteView(
            row.id.toString(), row.name, row.timeZone, row.latitude, row.longitude, row.radiusMeters, row.status,
            row.createdAt.toInstant().toString(),
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

    fun find(tenantId: UUID, id: UUID): SiteRow? =
        dsl.fetchOne("select $COLUMNS from site where tenant_id = ? and id = ?", tenantId, id)?.let(::row)

    fun page(tenantId: UUID, after: PageKey?, limit: Int): List<SiteRow> {
        val rows = if (after == null) {
            dsl.fetch("select $COLUMNS from site where tenant_id = ? order by created_at, id limit ?", tenantId, limit)
        } else {
            dsl.fetch(
                "select $COLUMNS from site where tenant_id = ? and (created_at, id) > " +
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

    fun update(tenantId: UUID, id: UUID, r: SiteRow) {
        dsl.execute(
            "update site set name = ?, time_zone = ?, latitude = cast(? as numeric), longitude = cast(? as numeric), " +
                "radius_m = ?, status = ? where tenant_id = ? and id = ?",
            r.name, r.timeZone, r.latitude, r.longitude, r.radiusMeters, r.status, tenantId, id,
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
    )

    private companion object {
        const val COLUMNS = "id, name, time_zone, latitude, longitude, radius_m, status, created_at"
    }
}

@Service
class SiteService(private val sites: SiteRepository, private val audit: AuditLog) {
    @Transactional
    fun create(person: CurrentPerson, request: SiteRequest): SiteRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val name = checks.text("name", request.name, MAX_NAME, required = true)
        val timeZone = checks.timeZone("timeZone", request.timeZone, required = true)
        val latitude = checks.decimal("latitude", request.latitude, -90.0, 90.0, required = true)
        val longitude = checks.decimal("longitude", request.longitude, -180.0, 180.0, required = true)
        val radius = checks.whole("radiusMeters", request.radiusMeters, MIN_RADIUS, MAX_RADIUS, required = true)
        // Una sede nace activa; el estado sólo se cambia después.
        if (request.status != null) checks.fail("status", "not_allowed", "No se da al crear la sede.")
        checks.done()

        val id = UUID.randomUUID()
        sites.insert(tenantId, id, name!!, timeZone!!, latitude!!, longitude!!, radius!!)
        audit.record(tenantId, person, "site.created", "site", id)
        return sites.find(tenantId, id)!!
    }

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, after: PageKey?, limit: Int): List<SiteRow> =
        sites.page(person.requireTenant(), after, limit + 1)

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): SiteRow = sites.find(person.requireTenant(), id) ?: throw Problems.notFound()

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
        val changed = listOfNotNull(
            name?.let { "name" }, timeZone?.let { "timeZone" }, latitude?.let { "latitude" },
            longitude?.let { "longitude" }, radius?.let { "radiusMeters" }, status?.let { "status" },
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
            ),
        )
        audit.record(tenantId, person, "site.updated", "site", id, mapOf("fields" to changed.joinToString(",")))
        return sites.find(tenantId, id)!!
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
        return Paging.page(service.page(person, Paging.decode(cursor), size), size, { PageKey(it.createdAt, it.id) }) { SiteView.of(it) }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: SiteRequest): SiteView =
        SiteView.of(service.create(person, request))

    @GetMapping("/{siteId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable siteId: UUID): SiteView =
        SiteView.of(service.get(person, siteId))

    @PatchMapping("/{siteId}")
    fun update(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable siteId: UUID,
        @RequestBody request: SiteRequest,
    ): SiteView = SiteView.of(service.update(person, siteId, request))
}
