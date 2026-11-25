package mx.fastsolution.zenit.user

import mx.fastsolution.zenit.api.ApiException
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.identity.AuditIdentityProvisioning
import mx.fastsolution.zenit.tenant.TenantRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Duration
import java.time.OffsetDateTime
import java.util.Base64
import java.util.HexFormat
import java.util.UUID

data class AuditInvitationView(val url: String, val expiresAt: String, val sent: Boolean)
data class AcceptAuditInvitation(val token: String)

@Service
class AuditInvitations(
    private val users: UserRepository,
    private val tenants: TenantRepository,
    private val audit: AuditLog,
    private val json: JsonMapper,
    private val identity: AuditIdentityProvisioning,
    @Value("\${ZENIT_AUDIT_PORTAL_URL:}") private val portalUrl: String,
    @Value("\${audit_brevo_key:}") private val mailKey: String,
    @Value("\${ZENIT_AUDIT_FROM:}") configuredSender: String,
    @Value("\${audit_mail_from:}") secretDirectorySender: String,
) {
    private val random = SecureRandom()
    private val sender = configuredSender.ifBlank { secretDirectorySender }.trim()
    private val mail = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()

    @Transactional
    fun issue(admin: CurrentPerson, id: UUID, send: Boolean): AuditInvitationView {
        val tenantId = admin.requireTenant()
        val user = users.find(tenantId, id) ?: throw Problems.notFound()
        val tenant = tenants.find(tenantId) ?: throw Problems.notFound()
        val origin = runCatching { URI.create(portalUrl) }.getOrNull()
        if (origin?.scheme != "https" || origin.host == null || origin.rawUserInfo != null ||
            origin.rawQuery != null || origin.rawFragment != null ||
            origin.path !in listOf("", "/", "/auditoria", "/auditoria/")) {
            throw unavailable()
        }
        if (send && (mailKey.isBlank() || sender.isBlank())) throw unavailable()
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32).also(random::nextBytes))
        val expiration = OffsetDateTime.now().plusHours(72)
        if (!users.issueAuditInvitation(tenantId, id, hash(token), expiration)) throw Problems.notFound()
        identity.prepare(user.email, user.displayName)
        val url = "${portalUrl.trimEnd('/')}/#invitacion=$token"
        if (send) sendMail(user, tenant.name, url)
        audit.record(tenantId, admin, "user.audit_invitation_issued", "user", id, mapOf("emailSent" to send.toString()))
        return AuditInvitationView(url, expiration.toInstant().toString(), send)
    }

    @Transactional
    fun accept(person: CurrentPerson, token: String): Map<String, Boolean> {
        val email = person.auditPortalVerifiedEmail ?: throw Problems.forbidden()
        if (!TOKEN.matches(token) || person.tenantId != null) throw Problems.notFound()
        val linked = users.acceptAuditInvitation(email, person.subject, hash(token)) ?: throw Problems.notFound()
        audit.record(linked.tenantId, person.copy(tenantId = linked.tenantId, userId = linked.id),
            "user.audit_invitation_accepted", "user", linked.id)
        return mapOf("accepted" to true)
    }

    private fun sendMail(user: UserRow, company: String, url: String) {
        val greeting = user.displayName.ifBlank { user.email }
        val payload = mapOf(
            "sender" to mapOf("email" to sender, "name" to "Zenit"),
            "to" to listOf(mapOf("email" to user.email)),
            "subject" to "$company te invitó a su portal de auditoría en Zenit",
            "textContent" to "Hola, $greeting.\n\n$company te invitó a consultar sus registros de auditoría en Zenit. " +
                "Tu acceso es individual y de solo lectura. Si es tu primera vez en Zenit, primero completa el correo de activación de tu cuenta.\n\n" +
                "Acepta la invitación: $url",
        )
        try {
            val request = HttpRequest.newBuilder(URI.create("https://api.brevo.com/v3/smtp/email"))
                .timeout(Duration.ofSeconds(10))
                .header("api-key", mailKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload))).build()
            if (mail.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() != 201) throw unavailable()
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            throw unavailable()
        } catch (_: java.io.IOException) {
            throw unavailable()
        }
    }

    private fun hash(token: String): String =
        HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.toByteArray(Charsets.US_ASCII)))

    private fun unavailable() = ApiException(HttpStatus.SERVICE_UNAVAILABLE, "audit-invitation-unavailable",
        "audit_invitation_unavailable", "Invitación no disponible", "Revisa la configuración del portal y del envío de correo.")

    companion object {
        private val TOKEN = Regex("[A-Za-z0-9_-]{43}")
    }
}

@RestController
class AuditInvitationController(private val invitations: AuditInvitations) {
    @PostMapping("/api/v1/users/{userId}/audit-invitation")
    fun issue(@AuthenticationPrincipal admin: CurrentPerson, @PathVariable userId: UUID,
              @RequestParam(defaultValue = "false") send: Boolean): AuditInvitationView =
        invitations.issue(admin, userId, send)

    @PostMapping("/api/v1/audit-invitations/accept")
    fun accept(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: AcceptAuditInvitation): Map<String, Boolean> =
        invitations.accept(person, request.token)
}
