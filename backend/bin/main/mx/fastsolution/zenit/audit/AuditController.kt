package mx.fastsolution.zenit.audit

import com.fasterxml.jackson.annotation.JsonRawValue
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.identity.CurrentPerson
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException

data class AuditReference(val type: String, val id: String?)

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
        @RequestParam from: String?,
        @RequestParam to: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<AuditView> {
        val size = Paging.limit(limit)
        val rows = audit.page(
            person.requireTenant(), action?.takeIf { it.isNotBlank() }, instant("from", from), instant("to", to),
            Paging.decode(cursor), size + 1,
        )
        return Paging.page(rows, size, { PageKey(it.at, it.id) }) {
            AuditView(
                id = it.id.toString(),
                at = it.at.toInstant().toString(),
                actor = AuditReference(it.actorType, it.actorId),
                action = it.action,
                target = AuditReference(it.targetType, it.targetId),
                correlationId = it.correlationId.toString(),
                metadata = it.metadata,
            )
        }
    }

    private fun instant(field: String, raw: String?): OffsetDateTime? {
        if (raw.isNullOrBlank()) return null
        return try {
            OffsetDateTime.parse(raw)
        } catch (e: DateTimeParseException) {
            throw Problems.validation(field, "invalid_date_time", "Debe ser un instante RFC 3339.")
        }
    }
}
