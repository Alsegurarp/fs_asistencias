package mx.fastsolution.zenit.audit

import com.fasterxml.jackson.annotation.JsonRawValue
import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.identity.CurrentPerson
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException

/** `displayName` viaja para que quien lee la bitácora no tenga que consultar cada persona u objeto. */
data class AuditReference(val type: String, val id: String?, val displayName: String?)

/** `capped` dice que hay más de `total`: la cuenta se detiene en `cap`. */
data class AuditSummaryView(val total: Int, val capped: Boolean, val cap: Int)

data class AuditView(
    val id: String,
    val at: String,
    val actor: AuditReference,
    val action: String,
    val target: AuditReference,
    val correlationId: String,
    /** Ya es JSON en la base; se entrega tal cual. */
    @get:JsonRawValue val metadata: String,
)

/** Bitácora de la empresa de quien llama. */
@RestController
@RequestMapping("/api/v1/audit-log")
class AuditController(private val audit: AuditLog) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam action: String?,
        @RequestParam group: String?,
        @RequestParam actorType: String?,
        @RequestParam actorId: String?,
        @RequestParam targetType: String?,
        @RequestParam targetId: String?,
        @RequestParam from: String?,
        @RequestParam to: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<AuditView> {
        val size = Paging.limit(limit)
        val tenantId = person.requireTenant()
        val filter = filter(action, group, actorType, actorId, targetType, targetId, from, to)
        val rows = audit.page(tenantId, filter, Paging.decode(cursor), size + 1)
        val names = audit.names(tenantId, rows.take(size))
        return Paging.page(rows, size, { PageKey(it.at, it.id) }) {
            AuditView(
                id = it.id.toString(),
                at = it.at.toInstant().toString(),
                actor = AuditReference(it.actorType, it.actorId, names[it.actorType to it.actorId]),
                action = it.action,
                target = AuditReference(it.targetType, it.targetId, names[it.targetType to it.targetId]),
                correlationId = it.correlationId.toString(),
                metadata = it.metadata,
            )
        }
    }

    /** Cuántas acciones cumplen los filtros de la lista, hasta un tope; pasado el tope, `capped`. */
    @GetMapping("/summary")
    fun summary(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam action: String?,
        @RequestParam group: String?,
        @RequestParam actorType: String?,
        @RequestParam actorId: String?,
        @RequestParam targetType: String?,
        @RequestParam targetId: String?,
        @RequestParam from: String?,
        @RequestParam to: String?,
    ): AuditSummaryView {
        val filter = filter(action, group, actorType, actorId, targetType, targetId, from, to)
        val (total, capped) = audit.count(person.requireTenant(), filter, COUNT_CAP)
        return AuditSummaryView(total, capped, COUNT_CAP)
    }

    private fun filter(
        action: String?, group: String?, actorType: String?, actorId: String?, targetType: String?, targetId: String?,
        from: String?, to: String?,
    ): AuditFilter {
        val checks = Checks()
        checks.oneOf("group", group, AuditLog.GROUPS.keys, required = false)
        checks.oneOf("actorType", actorType, setOf("user", "device", "system"), required = false)
        val actor = checks.uuid("actorId", actorId, required = false)
        val targetKind = checks.text("targetType", targetType?.takeIf { it.isNotBlank() }, MAX_TYPE, required = false)
        val target = checks.uuid("targetId", targetId, required = false)
        if (target != null && targetKind == null) checks.fail("targetType", "required", "Va junto con targetId.")
        val start = instant(checks, "from", from)
        val end = instant(checks, "to", to)
        checks.done()
        return AuditFilter(
            action?.takeIf { it.isNotBlank() }, group, actorType, actor?.toString(), targetKind, target?.toString(), start, end,
        )
    }

    private fun instant(checks: Checks, field: String, raw: String?): OffsetDateTime? {
        if (raw.isNullOrBlank()) return null
        return try {
            OffsetDateTime.parse(raw)
        } catch (e: DateTimeParseException) {
            checks.fail(field, "invalid_date_time", "Debe ser un instante RFC 3339.")
            null
        }
    }

    private companion object {
        const val COUNT_CAP = 10_000
        const val MAX_TYPE = 40
    }
}
