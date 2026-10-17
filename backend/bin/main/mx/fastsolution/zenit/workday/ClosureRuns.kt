package mx.fastsolution.zenit.workday

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.jobs.JobHandler
import mx.fastsolution.zenit.jobs.JobProperties
import mx.fastsolution.zenit.jobs.JobRepository
import mx.fastsolution.zenit.jobs.JobRow
import mx.fastsolution.zenit.site.SiteRepository
import mx.fastsolution.zenit.tenant.TenantRepository
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID

@ConfigurationProperties("zenit.closures")
data class ClosureProperties(
    /** Cada cuánto se revisa si alguna empresa tiene una semana que ya debe cerrarse sola. */
    val scheduleCheckSeconds: Long = 60,
)

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ClosureProperties::class)
class ClosureConfig

data class RunRow(
    val id: UUID,
    val weekStart: LocalDate,
    val siteId: UUID?,
    val origin: String,
    val status: String,
    val requestedBy: UUID?,
    val total: Int?,
    val closed: Int,
    val blockedOpenIncidents: Int,
    val blockedOpenSegment: Int,
    val failure: String?,
    val createdAt: OffsetDateTime,
    val startedAt: OffsetDateTime?,
    val finishedAt: OffsetDateTime?,
)

data class BlockedCountView(val openIncidents: Int, val openSegment: Int)

data class WeekClosureRunView(
    val id: String,
    val weekStart: String,
    val siteId: String?,
    val origin: String,
    val status: String,
    val total: Int?,
    val closed: Int,
    val blocked: BlockedCountView,
    val requestedBy: String?,
    val failure: String?,
    val createdAt: String,
    val startedAt: String?,
    val finishedAt: String?,
) {
    companion object {
        fun of(row: RunRow) = WeekClosureRunView(
            id = row.id.toString(),
            weekStart = row.weekStart.toString(),
            siteId = row.siteId?.toString(),
            origin = row.origin,
            status = row.status,
            total = row.total,
            closed = row.closed,
            blocked = BlockedCountView(row.blockedOpenIncidents, row.blockedOpenSegment),
            requestedBy = row.requestedBy?.toString(),
            failure = row.failure,
            createdAt = row.createdAt.toInstant().toString(),
            startedAt = row.startedAt?.toInstant()?.toString(),
            finishedAt = row.finishedAt?.toInstant()?.toString(),
        )
    }
}

class WeekClosureRunRequest {
    var weekStart: String? = null
    var siteId: String? = null
}

@Repository
class ClosureRunRepository(private val dsl: DSLContext) {
    fun find(tenantId: UUID, id: UUID): RunRow? = dsl.fetchOne("$SELECT where tenant_id = ? and id = ?", tenantId, id)?.let(::row)

    /** La corrida que todavía no termina para esa semana y ese alcance, si la hay. */
    fun active(tenantId: UUID, weekStart: LocalDate, siteId: UUID?): RunRow? =
        dsl.fetchOne(
            "$SELECT where tenant_id = ? and week_start = cast(? as date) and status in ('queued', 'running') " +
                "and site_id is not distinct from cast(? as uuid)",
            tenantId, weekStart.toString(), siteId,
        )?.let(::row)

    fun page(tenantId: UUID, weekStart: LocalDate?, after: PageKey?, limit: Int): List<RunRow> {
        val sql = StringBuilder("$SELECT where tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (weekStart != null) {
            sql.append(" and week_start = cast(? as date)")
            binds += weekStart.toString()
        }
        if (after != null) {
            sql.append(" and (created_at, id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by created_at, id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { row(it) }
    }

    /** Falso si ya había una corrida que lo impide: otra en curso, o la programada de esa semana. */
    fun insert(tenantId: UUID, id: UUID, weekStart: LocalDate, siteId: UUID?, origin: String, requestedBy: UUID?): Boolean =
        dsl.execute(
            "insert into week_closure_run (tenant_id, id, week_start, site_id, origin, status, requested_by) " +
                "values (?, ?, cast(? as date), cast(? as uuid), ?, 'queued', cast(? as uuid)) on conflict do nothing",
            tenantId, id, weekStart.toString(), siteId, origin, requestedBy,
        ) == 1

    /** Semanas recientes que el cierre programado ya atendió, por empresa. */
    fun recentScheduled(since: LocalDate): Set<Pair<UUID, LocalDate>> =
        dsl.fetch(
            "select tenant_id, cast(week_start as text) as week_start from week_closure_run " +
                "where origin = 'scheduled' and week_start >= cast(? as date)",
            since.toString(),
        ).map { it.get("tenant_id", UUID::class.java) to LocalDate.parse(it.get("week_start", String::class.java)) }.toSet()

    fun start(tenantId: UUID, id: UUID, total: Int) {
        dsl.execute(
            "update week_closure_run set status = 'running', total = ?, started_at = coalesce(started_at, now()) " +
                "where tenant_id = ? and id = ? and status in ('queued', 'running')",
            total, tenantId, id,
        )
    }

    fun progress(tenantId: UUID, id: UUID, closed: Int, openIncidents: Int, openSegment: Int) {
        dsl.execute(
            "update week_closure_run set closed = ?, blocked_open_incidents = ?, blocked_open_segment = ? " +
                "where tenant_id = ? and id = ? and status = 'running'",
            closed, openIncidents, openSegment, tenantId, id,
        )
    }

    fun finish(tenantId: UUID, id: UUID, closed: Int, openIncidents: Int, openSegment: Int): Boolean =
        dsl.execute(
            "update week_closure_run set status = 'done', closed = ?, blocked_open_incidents = ?, blocked_open_segment = ?, " +
                "finished_at = now() where tenant_id = ? and id = ? and status = 'running'",
            closed, openIncidents, openSegment, tenantId, id,
        ) == 1

    fun fail(tenantId: UUID, id: UUID, failure: String): Boolean =
        dsl.execute(
            "update week_closure_run set status = 'failed', failure = ?, finished_at = now() " +
                "where tenant_id = ? and id = ? and status in ('queued', 'running')",
            failure, tenantId, id,
        ) == 1

    private fun row(r: Record) = RunRow(
        id = r.get("id", UUID::class.java),
        weekStart = LocalDate.parse(r.get("week_start", String::class.java)),
        siteId = r.get("site_id", UUID::class.java),
        origin = r.get("origin", String::class.java),
        status = r.get("status", String::class.java),
        requestedBy = r.get("requested_by", UUID::class.java),
        total = r.get("total", Number::class.java)?.toInt(),
        closed = r.get("closed", Number::class.java).toInt(),
        blockedOpenIncidents = r.get("blocked_open_incidents", Number::class.java).toInt(),
        blockedOpenSegment = r.get("blocked_open_segment", Number::class.java).toInt(),
        failure = r.get("failure", String::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        startedAt = r.get("started_at", OffsetDateTime::class.java),
        finishedAt = r.get("finished_at", OffsetDateTime::class.java),
    )

    private companion object {
        const val SELECT =
            "select id, cast(week_start as text) as week_start, site_id, origin, status, requested_by, total, closed, " +
                "blocked_open_incidents, blocked_open_segment, failure, created_at, started_at, finished_at from week_closure_run"
    }
}

/**
 * Corrida de cierre: cierra la semana de toda la empresa o de una sede como
 * trabajo, sin tope de personas. Pedirla sólo la encola. Cada persona se
 * cierra en su propia transacción, así que lo ya cerrado no se pierde si la
 * corrida se interrumpe, y repetirla retoma donde quedó.
 */
@Service
class ClosureRunService(
    private val runs: ClosureRunRepository,
    private val jobs: JobRepository,
    private val jobProperties: JobProperties,
    private val tenants: TenantRepository,
    private val sites: SiteRepository,
    private val rules: RuleRepository,
    private val audit: AuditLog,
) {
    @Transactional
    fun request(person: CurrentPerson, request: WeekClosureRunRequest): RunRow {
        val tenantId = person.requireTenant()
        val requestedBy = person.userId ?: throw Problems.forbidden()
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        val checks = Checks()
        val date = checks.date("weekStart", request.weekStart, required = true)
        val siteId = checks.uuid("siteId", request.siteId, required = false)
        if (siteId != null && sites.find(tenantId, siteId) == null) checks.fail("siteId", "site_not_found", "La sede no existe.")
        checks.done()

        val weekStart = WeekCalculator.weekStart(date!!, tenant.weekStartsOn)
        val until = weekStart.plusDays(7).atStartOfDay(ZoneId.of(tenant.timeZone)).toOffsetDateTime()
        // Una semana que no ha terminado todavía puede recibir marcajes.
        if (until > OffsetDateTime.now()) throw Problems.validation("weekStart", "week_not_finished", "La semana todavía no termina.")
        if (rules.effectiveOn(weekStart.plusDays(6)) == null) {
            throw Problems.validation("weekStart", "no_rules_for_date", "No hay reglas laborales registradas para esa semana.")
        }

        // Las corridas de una empresa se abren de una en una: pedir otra vez la misma devuelve la que ya corre.
        tenants.lock(tenantId)
        runs.active(tenantId, weekStart, siteId)?.let { return it }
        val id = UUID.randomUUID()
        check(runs.insert(tenantId, id, weekStart, siteId, REQUESTED, requestedBy)) { "La corrida no se pudo abrir" }
        jobs.enqueue(tenantId, ClosureRunJob.TYPE, id, jobProperties.maxAttempts)
        audit.record(
            tenantId, person, "week.closure_run_requested", "week_closure_run", id,
            mapOf("weekStart" to weekStart.toString(), "siteId" to (siteId?.toString() ?: "")),
        )
        return runs.find(tenantId, id)!!
    }

    /** Abre la corrida del cierre programado de esa semana. Falso si ya existía o si otra corrida de toda la empresa sigue en curso. */
    @Transactional
    fun openScheduled(tenantId: UUID, weekStart: LocalDate): Boolean {
        tenants.lock(tenantId)
        val id = UUID.randomUUID()
        if (!runs.insert(tenantId, id, weekStart, null, SCHEDULED, null)) return false
        jobs.enqueue(tenantId, ClosureRunJob.TYPE, id, jobProperties.maxAttempts)
        return true
    }

    @Transactional(readOnly = true)
    fun get(person: CurrentPerson, id: UUID): RunRow = runs.find(person.requireTenant(), id) ?: throw Problems.notFound()

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, week: String?, after: PageKey?, limit: Int): List<RunRow> {
        val tenantId = person.requireTenant()
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        val checks = Checks()
        val date = checks.date("week", week, required = false)
        checks.done()
        return runs.page(tenantId, date?.let { WeekCalculator.weekStart(it, tenant.weekStartsOn) }, after, limit + 1)
    }

    /** Deja la corrida como terminada, con su cuenta, y constancia en la bitácora. */
    @Transactional
    fun finish(tenantId: UUID, run: RunRow, by: Closer, closed: Int, openIncidents: Int, openSegment: Int) {
        if (!runs.finish(tenantId, run.id, closed, openIncidents, openSegment)) return
        audit.record(
            tenantId, by.actorType, by.actorId, "week.closure_run_finished", "week_closure_run", run.id,
            mapOf(
                "weekStart" to run.weekStart.toString(),
                "origin" to run.origin,
                "closed" to closed.toString(),
                "openIncidents" to openIncidents.toString(),
                "openSegment" to openSegment.toString(),
            ),
        )
    }

    @Transactional
    fun fail(tenantId: UUID, id: UUID, failure: String) {
        if (runs.fail(tenantId, id, failure)) {
            audit.record(tenantId, "system", null, "week.closure_run_failed", "week_closure_run", id, mapOf("failure" to failure))
        }
    }

    companion object {
        const val REQUESTED = "requested"
        const val SCHEDULED = "scheduled"
    }
}

/** Atiende una corrida de cierre y abre las del cierre programado. */
@Component
class ClosureRunJob(
    private val runs: ClosureRunRepository,
    private val service: ClosureRunService,
    private val closures: ClosureRepository,
    private val closer: WeekCloser,
    private val tenants: TenantRepository,
    private val rules: RuleRepository,
    private val jobs: JobRepository,
    private val jobProperties: JobProperties,
    private val properties: ClosureProperties,
) : JobHandler {
    override val type = TYPE

    @Volatile
    private var lastCheck: Instant = Instant.EPOCH

    // Sin transacción propia: cada persona se cierra en la suya.
    override fun handle(job: JobRow) {
        val tenantId = job.tenantId ?: return
        val run = runs.find(tenantId, job.referenceId) ?: return
        // Repetir el trabajo no vuelve a correr lo que ya terminó.
        if (run.status != "queued" && run.status != "running") return
        val tenant = tenants.find(tenantId) ?: return
        if (tenant.status != "active") {
            // Una empresa suspendida está cerrada también para lo que quedó encolado.
            service.fail(tenantId, run.id, "tenant_not_active")
            return
        }
        val zone = ZoneId.of(tenant.timeZone)
        val from = run.weekStart.atStartOfDay(zone).toOffsetDateTime()
        val until = run.weekStart.plusDays(7).atStartOfDay(zone).toOffsetDateTime()
        val people = closures.candidates(tenantId, run.siteId, from, until, Int.MAX_VALUE)
        runs.start(tenantId, run.id, people.size)

        val by = if (run.requestedBy != null) Closer(run.requestedBy, "user", run.requestedBy.toString()) else Closer(null, "system", null)
        var closed = 0
        var openIncidents = 0
        var openSegment = 0
        people.forEachIndexed { index, employeeId ->
            when (val outcome = closer.closeAlone(tenant, employeeId, run.weekStart, by)) {
                is CloseOutcome.Closed -> closed++
                is CloseOutcome.Blocked -> if (outcome.reason == "open_incidents") openIncidents++ else openSegment++
                CloseOutcome.Unknown -> Unit
            }
            if ((index + 1) % PROGRESS_EVERY == 0) {
                // Deja ver el avance y conserva el trabajo: una corrida larga no debe parecer abandonada.
                runs.progress(tenantId, run.id, closed, openIncidents, openSegment)
                jobs.extend(job.id, jobProperties.leaseSeconds)
            }
        }
        service.finish(tenantId, run, by, closed, openIncidents, openSegment)
    }

    override fun abandoned(job: JobRow, error: String) {
        val tenantId = job.tenantId ?: return
        // Lo que ya se cerró sigue cerrado; pedir otra corrida retoma lo que faltó.
        service.fail(tenantId, job.referenceId, "job_abandoned")
    }

    /** El cierre programado se revisa de vez en cuando, no en cada vuelta. */
    override fun maintain() {
        val now = Instant.now()
        if (Duration.between(lastCheck, now).seconds < properties.scheduleCheckSeconds) return
        lastCheck = now
        schedule(OffsetDateTime.now())
    }

    /**
     * Abre la corrida de cada empresa que pidió cierre programado y cuya
     * última semana terminada ya cumplió su plazo. Pasa una vez por semana y
     * empresa. Devuelve cuántas abrió.
     */
    fun schedule(now: OffsetDateTime): Int {
        val candidates = tenants.autoClosing()
        if (candidates.isEmpty()) return 0
        val attended = runs.recentScheduled(now.toLocalDate().minusDays(LOOK_BACK_DAYS))
        var opened = 0
        for (tenant in candidates) {
            val zone = ZoneId.of(tenant.timeZone)
            val weekStart = WeekCalculator.weekStart(now.atZoneSameInstant(zone).toLocalDate(), tenant.weekStartsOn).minusDays(7)
            if (tenant.id to weekStart in attended) continue
            val due = weekStart.plusDays(7).atStartOfDay(zone).toOffsetDateTime().plusHours(tenant.autoCloseAfterHours!!.toLong())
            if (now < due) continue
            // Sin reglas para esa semana no hay con qué calcular: se espera a que existan.
            if (rules.effectiveOn(weekStart.plusDays(6)) == null) continue
            if (service.openScheduled(tenant.id, weekStart)) opened++
        }
        return opened
    }

    companion object {
        const val TYPE = "week_closure"
        private const val PROGRESS_EVERY = 25
        private const val LOOK_BACK_DAYS = 21L
    }
}

@RestController
@RequestMapping("/api/v1/week-closure-runs")
class ClosureRunController(private val service: ClosureRunService) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam week: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<WeekClosureRunView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, week, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.createdAt, it.id) }) { WeekClosureRunView.of(it) }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun request(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: WeekClosureRunRequest): WeekClosureRunView =
        WeekClosureRunView.of(service.request(person, request))

    @GetMapping("/{runId}")
    fun get(@AuthenticationPrincipal person: CurrentPerson, @PathVariable runId: UUID): WeekClosureRunView =
        WeekClosureRunView.of(service.get(person, runId))
}
