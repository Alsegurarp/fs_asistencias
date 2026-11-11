package mx.fastsolution.zenit.card

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.api.TextSearch
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.employee.EmployeeRepository
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.tenant.TenantRepository
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
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
import java.time.OffsetDateTime
import java.util.UUID

data class CardRow(
    val id: UUID,
    val label: String,
    val status: String,
    val keyVersion: Int?,
    val technology: String,
    val employeeId: UUID?,
    val assignedSince: OffsetDateTime?,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
    /** La asignación más reciente, vigente o terminada; nula en la búsqueda de la captura, que no la necesita. */
    val latest: LatestHolder? = null,
)

data class LatestHolder(
    val employeeId: UUID,
    val employeeName: String,
    val employeeExternalId: String,
    val since: OffsetDateTime,
    val until: OffsetDateTime?,
)

data class OpenAssignment(val id: UUID, val cardId: UUID)

data class CardAssignmentRow(val id: UUID, val cardId: UUID, val employeeId: UUID, val since: OffsetDateTime, val replacedCardId: UUID?)

class CardCreateRequest {
    var label: String? = null
    var fingerprint: String? = null
}

class CardAssignmentRequest {
    var employeeId: String? = null
}

class CardRevocationRequest {
    var reason: String? = null
    var note: String? = null
}

data class CardHolder(val employeeId: String, val employeeName: String, val employeeExternalId: String, val since: String)

data class LatestHolderView(val employeeId: String, val employeeName: String, val employeeExternalId: String, val since: String, val until: String?)

/** La huella nunca sale: sólo entra al registrar la tarjeta. */
data class CardView(
    val id: String,
    val label: String,
    val status: String,
    val keyVersion: Int?,
    val technology: String,
    val assignment: CardHolder?,
    val latestAssignment: LatestHolderView?,
    val createdAt: String,
    val updatedAt: String,
) {
    companion object {
        fun of(row: CardRow): CardView {
            val latest = row.latest
            return CardView(
                id = row.id.toString(),
                label = row.label,
                status = row.status,
                keyVersion = row.keyVersion,
                technology = row.technology,
                // La vigente es la más reciente sin fin: de ahí salen los nombres.
                assignment = if (row.employeeId != null && row.assignedSince != null && latest != null && latest.until == null) {
                    CardHolder(row.employeeId.toString(), latest.employeeName, latest.employeeExternalId, row.assignedSince.toInstant().toString())
                } else {
                    null
                },
                latestAssignment = latest?.let {
                    LatestHolderView(
                        it.employeeId.toString(), it.employeeName, it.employeeExternalId, it.since.toInstant().toString(),
                        it.until?.toInstant()?.toString(),
                    )
                },
                createdAt = row.createdAt.toInstant().toString(),
                updatedAt = row.updatedAt.toInstant().toString(),
            )
        }
    }
}

data class CardSummaryView(val total: Int, val byStatus: Map<String, Int>)

/** Quién registró la tarjeta: una persona del portal o una terminal que la preparó. */
data class CardRegistrarView(val type: String, val name: String?)

data class CardHistoryView(
    val employeeId: String,
    val employeeName: String,
    val employeeExternalId: String,
    val since: String,
    val until: String?,
    val replacedCardId: String?,
)

data class CardLastReadView(val observedAt: String, val deviceId: String, val deviceName: String)

/** El detalle de una tarjeta: lo de la lista, quién la registró, todas sus asignaciones, cuántas lecturas tiene y la última. */
data class CardDetailView(
    val id: String,
    val label: String,
    val status: String,
    val keyVersion: Int?,
    val technology: String,
    val assignment: CardHolder?,
    val latestAssignment: LatestHolderView?,
    val createdAt: String,
    val updatedAt: String,
    val registeredBy: CardRegistrarView?,
    val assignments: List<CardHistoryView>,
    val lastRead: CardLastReadView?,
    val readCount: Int,
)

data class CardAssignmentView(
    val id: String,
    val cardId: String,
    val employeeId: String,
    val since: String,
    val until: String?,
    val replacedCardId: String?,
)

@Repository
class CardRepository(private val dsl: DSLContext) {
    fun insert(tenantId: UUID, id: UUID, label: String, fingerprint: String, keyVersion: Int? = null, technology: String = MANUAL) {
        dsl.execute(
            "insert into card (tenant_id, id, label, fingerprint, key_version, technology, status) values (?, ?, ?, ?, cast(? as integer), ?, 'inventory')",
            tenantId, id, label, fingerprint, keyVersion, technology,
        )
    }

    fun find(tenantId: UUID, id: UUID): CardRow? = dsl.fetchOne("$NAMED where c.tenant_id = ? and c.id = ?", tenantId, id)?.let(::named)

    /** La captura identifica la tarjeta por su huella, dentro de la empresa del dispositivo; no necesita nombres. */
    fun findByFingerprint(tenantId: UUID, fingerprint: String): CardRow? =
        dsl.fetchOne("$SELECT where c.tenant_id = ? and c.fingerprint = ?", tenantId, fingerprint)?.let(::row)

    /** `text` busca en la etiqueta y en el nombre y el número de quien la tuvo por última vez. */
    fun page(tenantId: UUID, statuses: Set<String>, text: String?, after: PageKey?, limit: Int): List<CardRow> {
        val sql = StringBuilder("$NAMED where c.tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (statuses.isNotEmpty()) {
            sql.append(" and c.status = any(?)")
            binds.add(statuses.toTypedArray())
        }
        if (text != null) {
            sql.append(TextSearch.clause("c.label", "h.display_name", "h.external_id"))
            binds.addAll(TextSearch.binds(text, 3))
        }
        if (after != null) {
            sql.append(" and (c.created_at, c.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by c.created_at, c.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { named(it) }
    }

    /** Conteos por estado con la búsqueda de la lista, sin filtrar por estado: rotulan cada opción. */
    fun summary(tenantId: UUID, text: String?): CardSummaryView {
        val sql = StringBuilder("select c.status, count(*) as cards $NAMED_FROM where c.tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (text != null) {
            sql.append(TextSearch.clause("c.label", "h.display_name", "h.external_id"))
            binds.addAll(TextSearch.binds(text, 3))
        }
        sql.append(" group by c.status")
        val counts = dsl.fetch(sql.toString(), *binds.toTypedArray())
            .associate { it.get("status", String::class.java) to it.get("cards", Number::class.java).toInt() }
        return CardSummaryView(counts.values.sum(), STATUSES.associateWith { counts[it] ?: 0 })
    }

    fun setStatus(tenantId: UUID, id: UUID, status: String) {
        dsl.execute("update card set status = ?, updated_at = now() where tenant_id = ? and id = ?", status, tenantId, id)
    }

    fun openAssignmentOfEmployee(tenantId: UUID, employeeId: UUID): OpenAssignment? =
        dsl.fetchOne(
            "select id, card_id from card_assignment where tenant_id = ? and employee_id = ? and until is null", tenantId, employeeId,
        )?.let { OpenAssignment(it.get("id", UUID::class.java), it.get("card_id", UUID::class.java)) }

    /** Todas las asignaciones de la tarjeta, de la más reciente a la primera. */
    fun history(tenantId: UUID, cardId: UUID): List<CardHistoryView> =
        dsl.fetch(
            "select a.employee_id, e.display_name, e.external_id, a.since, a.until, a.replaced_card_id from card_assignment a " +
                "join employee e on e.tenant_id = a.tenant_id and e.id = a.employee_id " +
                "where a.tenant_id = ? and a.card_id = ? order by a.since desc, a.id desc",
            tenantId, cardId,
        ).map {
            CardHistoryView(
                it.get("employee_id", UUID::class.java).toString(), it.get("display_name", String::class.java), it.get("external_id", String::class.java),
                it.get("since", OffsetDateTime::class.java).toInstant().toString(), it.get("until", OffsetDateTime::class.java)?.toInstant()?.toString(),
                it.get("replaced_card_id", UUID::class.java)?.toString(),
            )
        }

    /** El último marcaje guardado con la tarjeta y el lector que la leyó. */
    fun lastRead(tenantId: UUID, cardId: UUID): CardLastReadView? =
        dsl.fetchOne(
            "select e.observed_at, d.id as device_id, coalesce(d.label, case when d.mode = 'personal' then 'Teléfono de ' || o.display_name else 'Terminal' end, d.model) as device_name " +
                "from attendance_event e join device d on d.tenant_id = e.tenant_id and d.id = e.device_id " +
                "left join employee o on o.tenant_id = d.tenant_id and o.id = d.employee_id " +
                "where e.tenant_id = ? and e.card_id = ? order by e.observed_at desc limit 1",
            tenantId, cardId,
        )?.let {
            CardLastReadView(it.get("observed_at", OffsetDateTime::class.java).toInstant().toString(), it.get("device_id", UUID::class.java).toString(), it.get("device_name", String::class.java))
        }

    /** Cuántos marcajes se guardaron con la tarjeta. */
    fun readCount(tenantId: UUID, cardId: UUID): Int =
        dsl.fetchOne("select count(*) from attendance_event where tenant_id = ? and card_id = ?", tenantId, cardId)!!.get(0, Number::class.java).toInt()

    /** Quién la registró, según la bitácora: la persona del portal o la terminal que la preparó. */
    fun registrar(tenantId: UUID, cardId: UUID): CardRegistrarView? =
        dsl.fetchOne(
            "select l.actor_type, coalesce(u.display_name, d.label, case when d.mode = 'terminal' then 'Terminal' end) as name from audit_log l " +
                "left join tenant_user u on l.actor_type = 'user' and u.tenant_id = l.tenant_id and u.id::text = l.actor_id " +
                "left join device d on l.actor_type = 'device' and d.tenant_id = l.tenant_id and d.id::text = l.actor_id " +
                "where l.tenant_id = ? and l.action = 'card.registered' and l.target_type = 'card' and l.target_id = ? order by l.at limit 1",
            tenantId, cardId.toString(),
        )?.let { CardRegistrarView(if (it.get("actor_type", String::class.java) == "device") "device" else "user", it.get("name", String::class.java)) }

    fun holderAt(tenantId: UUID, cardId: UUID, at: OffsetDateTime): UUID? =
        dsl.fetchOne("select employee_id from card_assignment where tenant_id = ? and card_id = ? " +
            "and since <= cast(? as timestamptz) and until >= cast(? as timestamptz) order by since desc limit 1",
            tenantId, cardId, at, at)?.get("employee_id", UUID::class.java)

    fun closeAssignmentOfCard(tenantId: UUID, cardId: UUID) {
        dsl.execute("update card_assignment set until = now() where tenant_id = ? and card_id = ? and until is null", tenantId, cardId)
    }

    fun insertAssignment(tenantId: UUID, id: UUID, cardId: UUID, employeeId: UUID, replacedCardId: UUID?): CardAssignmentRow {
        val r = dsl.fetchOne(
            "insert into card_assignment (tenant_id, id, card_id, employee_id, replaced_card_id) " +
                "values (?, ?, ?, ?, cast(? as uuid)) returning since",
            tenantId, id, cardId, employeeId, replacedCardId,
        )!!
        return CardAssignmentRow(id, cardId, employeeId, r.get("since", OffsetDateTime::class.java), replacedCardId)
    }

    private fun row(r: Record) = CardRow(
        id = r.get("id", UUID::class.java),
        label = r.get("label", String::class.java),
        status = r.get("status", String::class.java),
        keyVersion = r.get("key_version", Number::class.java)?.toInt(),
        technology = r.get("technology", String::class.java),
        employeeId = r.get("employee_id", UUID::class.java),
        assignedSince = r.get("since", OffsetDateTime::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        updatedAt = r.get("updated_at", OffsetDateTime::class.java),
    )

    private fun named(r: Record) = row(r).copy(
        latest = r.get("latest_employee_id", UUID::class.java)?.let {
            LatestHolder(
                it, r.get("latest_employee_name", String::class.java), r.get("latest_employee_external_id", String::class.java),
                r.get("latest_since", OffsetDateTime::class.java), r.get("latest_until", OffsetDateTime::class.java),
            )
        },
    )

    companion object {
        /** Los estados de una tarjeta, en el orden en que se muestran. */
        val STATUSES = linkedSetOf("inventory", "assigned", "active", "lost", "damaged", "revoked", "replaced")

        /** La huella se escribió a mano: la tarjeta simulada o sin firma. */
        const val MANUAL = "manual"

        private const val SELECT =
            "select c.id, c.label, c.status, c.key_version, c.technology, c.created_at, c.updated_at, a.employee_id, a.since " +
                "from card c left join card_assignment a " +
                "on a.tenant_id = c.tenant_id and a.card_id = c.id and a.until is null"

        /** Con quien la tuvo por última vez, para nombrarlo aunque la tarjeta ya no esté asignada. */
        private const val NAMED_FROM =
            "from card c left join card_assignment a on a.tenant_id = c.tenant_id and a.card_id = c.id and a.until is null " +
                "left join lateral (select l.employee_id, l.since, l.until from card_assignment l where l.tenant_id = c.tenant_id " +
                "and l.card_id = c.id order by l.since desc, l.id desc limit 1) l on true " +
                "left join employee h on h.tenant_id = c.tenant_id and h.id = l.employee_id"

        private const val NAMED =
            "select c.id, c.label, c.status, c.key_version, c.technology, c.created_at, c.updated_at, a.employee_id, a.since, " +
                "l.employee_id as latest_employee_id, h.display_name as latest_employee_name, " +
                "h.external_id as latest_employee_external_id, l.since as latest_since, l.until as latest_until $NAMED_FROM"
    }
}

/**
 * Ciclo de vida de una tarjeta: inventario, activa al asignarse, y de ahí
 * reemplazada, revocada, perdida o dañada. Una tarjeta que ya tuvo titular no
 * vuelve a asignarse a nadie.
 */
@Service
class CardService(
    private val cards: CardRepository,
    private val employees: EmployeeRepository,
    private val tenants: TenantRepository,
    private val audit: AuditLog,
) {
    @Transactional
    fun register(person: CurrentPerson, request: CardCreateRequest): CardRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val label = checks.text("label", request.label, MAX_LABEL, required = true)
        val fingerprint = request.fingerprint
        if (fingerprint == null || fingerprint.length !in MIN_FINGERPRINT..MAX_FINGERPRINT || fingerprint.any { it.isWhitespace() }) {
            checks.fail("fingerprint", "invalid_fingerprint", "Lleva de $MIN_FINGERPRINT a $MAX_FINGERPRINT caracteres, sin espacios.")
        }
        checks.done()

        val id = UUID.randomUUID()
        try {
            cards.insert(tenantId, id, label!!, fingerprint!!)
        } catch (e: RuntimeException) {
            throw when (Conflicts.uniqueConstraint(e)) {
                Conflicts.CARD_LABEL, Conflicts.CARD_FINGERPRINT -> Conflicts.cardTaken()
                else -> e
            }
        }
        // La huella no va a la bitácora.
        audit.record(tenantId, person, "card.registered", "card", id)
        return cards.find(tenantId, id)!!
    }

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, statuses: List<String>?, q: String?, after: PageKey?, limit: Int): List<CardRow> {
        val checks = Checks()
        statuses.orEmpty().forEach { checks.oneOf("status", it, STATUSES, required = false) }
        val text = TextSearch.pattern(checks, q)
        checks.done()
        return cards.page(person.requireTenant(), statuses.orEmpty().toSet(), text, after, limit + 1)
    }

    /** Cuántas tarjetas hay en cada estado, con la misma búsqueda que la lista. */
    @Transactional(readOnly = true)
    fun summary(person: CurrentPerson, q: String?): CardSummaryView {
        val checks = Checks()
        val text = TextSearch.pattern(checks, q)
        checks.done()
        return cards.summary(person.requireTenant(), text)
    }

    @Transactional(readOnly = true)
    fun detail(person: CurrentPerson, cardId: UUID): CardDetailView {
        val tenantId = person.requireTenant()
        val card = cards.find(tenantId, cardId) ?: throw Problems.notFound()
        val view = CardView.of(card)
        return CardDetailView(
            view.id, view.label, view.status, view.keyVersion, view.technology, view.assignment, view.latestAssignment, view.createdAt, view.updatedAt,
            cards.registrar(tenantId, cardId), cards.history(tenantId, cardId), cards.lastRead(tenantId, cardId), cards.readCount(tenantId, cardId),
        )
    }

    /**
     * Asigna una tarjeta del inventario. Si la persona ya tenía una, cierra esa
     * asignación, marca la anterior como reemplazada y activa la nueva, todo en
     * la misma transacción: el reemplazo no depende de que falle una unicidad.
     */
    @Transactional
    fun assign(person: CurrentPerson, cardId: UUID, request: CardAssignmentRequest): CardAssignmentRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val employeeId = checks.uuid("employeeId", request.employeeId, required = true)
        checks.done()

        // Los cambios de tarjetas de una empresa pasan de uno en uno.
        tenants.lock(tenantId)
        val card = cards.find(tenantId, cardId) ?: throw Problems.notFound()
        if (!employees.lock(tenantId, employeeId!!)) throw Problems.validation("employeeId", "employee_not_found", "La persona no existe.")
        val employee = employees.find(tenantId, employeeId!!)
            ?: throw Problems.validation("employeeId", "employee_not_found", "La persona no existe.")
        if (employee.status != "active") throw Problems.conflict("employee_inactive", "La persona está dada de baja.")
        if (card.status != "inventory") {
            throw Problems.conflict("card_not_assignable", "Sólo se asigna una tarjeta que está en inventario.")
        }

        val previous = cards.openAssignmentOfEmployee(tenantId, employeeId)
        if (previous != null) {
            cards.setStatus(tenantId, previous.cardId, "replaced")
            cards.closeAssignmentOfCard(tenantId, previous.cardId)
        }
        val created = cards.insertAssignment(tenantId, UUID.randomUUID(), cardId, employeeId, previous?.cardId)
        cards.setStatus(tenantId, cardId, "active")
        audit.record(
            tenantId, person, "card.assigned", "card", cardId,
            buildMap {
                put("employeeId", employeeId.toString())
                if (previous != null) put("replacedCardId", previous.cardId.toString())
            },
        )
        return created
    }

    /** Desde este momento la tarjeta no marca y no vuelve a asignarse. */
    @Transactional
    fun revoke(person: CurrentPerson, cardId: UUID, request: CardRevocationRequest): CardRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val reason = checks.oneOf("reason", request.reason, REASONS, required = true)
        val note = checks.text("note", request.note, MAX_NOTE, required = false)
        checks.done()

        tenants.lock(tenantId)
        val card = cards.find(tenantId, cardId) ?: throw Problems.notFound()
        card.employeeId?.let { employees.lock(tenantId, it) }
        if (card.status !in REVOCABLE) {
            throw Problems.conflict("card_not_revocable", "La tarjeta ya no está en uso ni en inventario.")
        }
        cards.closeAssignmentOfCard(tenantId, cardId)
        cards.setStatus(tenantId, cardId, reason!!)
        audit.record(
            tenantId, person, "card.revoked", "card", cardId,
            buildMap {
                put("reason", reason)
                if (note != null) put("note", note)
            },
        )
        return cards.find(tenantId, cardId)!!
    }

    private companion object {
        const val MAX_LABEL = 40
        const val MIN_FINGERPRINT = 16
        const val MAX_FINGERPRINT = 128
        const val MAX_NOTE = 280
        val STATUSES = CardRepository.STATUSES
        val REASONS = setOf("revoked", "lost", "damaged")
        val REVOCABLE = setOf("inventory", "assigned", "active")
    }
}

@RestController
@RequestMapping("/api/v1/cards")
class CardController(private val service: CardService) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam status: List<String>?,
        @RequestParam q: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<CardView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, status, q, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.createdAt, it.id) }) { CardView.of(it) }
    }

    @GetMapping("/summary")
    fun summary(@AuthenticationPrincipal person: CurrentPerson, @RequestParam q: String?): CardSummaryView = service.summary(person, q)

    @GetMapping("/{cardId}")
    fun detail(@AuthenticationPrincipal person: CurrentPerson, @PathVariable cardId: UUID): CardDetailView = service.detail(person, cardId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun register(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: CardCreateRequest): CardView =
        CardView.of(service.register(person, request))

    @PostMapping("/{cardId}/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    fun assign(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable cardId: UUID,
        @RequestBody request: CardAssignmentRequest,
    ): CardAssignmentView {
        val row = service.assign(person, cardId, request)
        return CardAssignmentView(
            row.id.toString(), row.cardId.toString(), row.employeeId.toString(), row.since.toInstant().toString(),
            null, row.replacedCardId?.toString(),
        )
    }

    @PostMapping("/{cardId}/revocation")
    fun revoke(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable cardId: UUID,
        @RequestBody request: CardRevocationRequest,
    ): CardView = CardView.of(service.revoke(person, cardId, request))
}
