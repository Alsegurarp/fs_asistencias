package mx.fastsolution.zenit.card

import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Conflicts
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
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
    val employeeId: UUID?,
    val assignedSince: OffsetDateTime?,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
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

data class CardHolder(val employeeId: String, val since: String)

/** La huella nunca sale: sólo entra al registrar la tarjeta. */
data class CardView(
    val id: String,
    val label: String,
    val status: String,
    val keyVersion: Int?,
    val assignment: CardHolder?,
    val createdAt: String,
    val updatedAt: String,
) {
    companion object {
        fun of(row: CardRow) = CardView(
            id = row.id.toString(),
            label = row.label,
            status = row.status,
            keyVersion = row.keyVersion,
            assignment = if (row.employeeId != null && row.assignedSince != null) {
                CardHolder(row.employeeId.toString(), row.assignedSince.toInstant().toString())
            } else {
                null
            },
            createdAt = row.createdAt.toInstant().toString(),
            updatedAt = row.updatedAt.toInstant().toString(),
        )
    }
}

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
    fun insert(tenantId: UUID, id: UUID, label: String, fingerprint: String) {
        dsl.execute(
            "insert into card (tenant_id, id, label, fingerprint, status) values (?, ?, ?, ?, 'inventory')",
            tenantId, id, label, fingerprint,
        )
    }

    fun find(tenantId: UUID, id: UUID): CardRow? = dsl.fetchOne("$SELECT where c.tenant_id = ? and c.id = ?", tenantId, id)?.let(::row)

    /** La captura identifica la tarjeta por su huella, dentro de la empresa del dispositivo. */
    fun findByFingerprint(tenantId: UUID, fingerprint: String): CardRow? =
        dsl.fetchOne("$SELECT where c.tenant_id = ? and c.fingerprint = ?", tenantId, fingerprint)?.let(::row)

    fun page(tenantId: UUID, status: String?, after: PageKey?, limit: Int): List<CardRow> {
        val sql = StringBuilder("$SELECT where c.tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (status != null) {
            sql.append(" and c.status = ?")
            binds += status
        }
        if (after != null) {
            sql.append(" and (c.created_at, c.id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by c.created_at, c.id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { row(it) }
    }

    fun setStatus(tenantId: UUID, id: UUID, status: String) {
        dsl.execute("update card set status = ?, updated_at = now() where tenant_id = ? and id = ?", status, tenantId, id)
    }

    fun openAssignmentOfEmployee(tenantId: UUID, employeeId: UUID): OpenAssignment? =
        dsl.fetchOne(
            "select id, card_id from card_assignment where tenant_id = ? and employee_id = ? and until is null", tenantId, employeeId,
        )?.let { OpenAssignment(it.get("id", UUID::class.java), it.get("card_id", UUID::class.java)) }

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
        employeeId = r.get("employee_id", UUID::class.java),
        assignedSince = r.get("since", OffsetDateTime::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
        updatedAt = r.get("updated_at", OffsetDateTime::class.java),
    )

    private companion object {
        const val SELECT =
            "select c.id, c.label, c.status, c.key_version, c.created_at, c.updated_at, a.employee_id, a.since " +
                "from card c left join card_assignment a " +
                "on a.tenant_id = c.tenant_id and a.card_id = c.id and a.until is null"
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
    fun page(person: CurrentPerson, status: String?, after: PageKey?, limit: Int): List<CardRow> {
        val checks = Checks()
        checks.oneOf("status", status, STATUSES, required = false)
        checks.done()
        return cards.page(person.requireTenant(), status, after, limit + 1)
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
        val STATUSES = setOf("inventory", "assigned", "active", "revoked", "lost", "damaged", "replaced")
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
        @RequestParam status: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<CardView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, status, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.createdAt, it.id) }) { CardView.of(it) }
    }

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
