package mx.fastsolution.zenit.dossier

import mx.fastsolution.zenit.api.ApiException
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.export.sha256
import mx.fastsolution.zenit.identity.CurrentPerson
import org.jooq.DSLContext
import org.jooq.Record
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Service
import org.springframework.context.annotation.Profile
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody
import tools.jackson.databind.JsonNode
import java.nio.charset.StandardCharsets.UTF_8
import java.nio.file.Path
import java.security.SecureRandom
import java.time.Instant
import java.time.OffsetDateTime
import java.util.Base64
import java.util.UUID

class DossierChallengeRequest { var codeChallenge: JsonNode? = null }
class DossierAuthorizationRequest { var challengeId: JsonNode? = null; var state: JsonNode? = null; var code: JsonNode? = null; var codeVerifier: JsonNode? = null }
class DossierDownloadRequest { var authorization: JsonNode? = null }
data class DossierChallengeView(val id: UUID, val authorizationUrl: String, val state: String, val expiresAt: String)
data class DossierAuthorizationView(val authorization: String, val expiresAt: String)
data class DossierDelivery(val id: UUID, val path: Path)

@Service
@Profile("!migrate")
class DossierVerification(
    private val access: DossierAccess, private val dossiers: DossierRepository, private val dsl: DSLContext,
    private val oidc: DossierOidc, private val files: DossierDownloadFiles, private val audit: AuditLog,
) {
    @Transactional
    fun challenge(person: CurrentPerson, id: UUID, request: DossierChallengeRequest): DossierChallengeView {
        val account = access.require(person)
        val dossier = ready(account, id)
        val codeChallenge = strictText("codeChallenge", request.codeChallenge, OPAQUE, 43)
        val state = random(); val nonce = random(); val challengeId = UUID.randomUUID()
        val url = oidc.authorizationUrl(state, nonce, codeChallenge)
        val versions = versions(account)
        val expires = minOf(Instant.now().plusSeconds(300), Instant.parse(dossier.view.expiresAt))
        dsl.execute("update dossier_challenge set invalidated_at = clock_timestamp() where tenant_id = ? and dossier_id = ? and invalidated_at is null", account.tenantId, id)
        dsl.execute(
            "insert into dossier_challenge (tenant_id,id,dossier_id,user_id,state_sha256,nonce_sha256,code_challenge,permission_version,account_version,tenant_version,expires_at) " +
                "values (?,?,?,?,?,?,?,?,?,?,cast(? as timestamptz))",
            account.tenantId, challengeId, id, account.userId, hash(state), hash(nonce), codeChallenge,
            versions.get("permission_version"), versions.get("account_version"), versions.get("tenant_version"), expires.toString(),
        )
        audit.record(account.tenantId, person, "dossier.challenge_created", "dossier", id)
        return DossierChallengeView(challengeId, url, state, expires.toString())
    }

    // Un código canjeado o de resultado incierto nunca se vuelve a usar, incluso si falla identidad.
    @Transactional(noRollbackFor = [ApiException::class])
    fun authorize(person: CurrentPerson, id: UUID, request: DossierAuthorizationRequest): DossierAuthorizationView {
        val account = access.require(person)
        val dossier = ready(account, id)
        val challengeId = try { UUID.fromString(strictText("challengeId", request.challengeId)) } catch (_: IllegalArgumentException) { throw Problems.validation("challengeId", "invalid_identifier", "Debe ser UUID.") }
        val state = strictText("state", request.state, OPAQUE, 43)
        val verifier = strictText("codeVerifier", request.codeVerifier, VERIFIER, 128)
        val code = strictText("code", request.code)
        val challenge = dsl.fetchOne("select id,state_sha256,nonce_sha256,code_challenge,permission_version,account_version,tenant_version,created_at,expires_at,consumed_at,invalidated_at from dossier_challenge where tenant_id = ? and id = ? and dossier_id = ? and user_id = ? for update",
            account.tenantId, challengeId, id, account.userId) ?: throw Problems.notFound()
        validateChallenge(challenge, versions(account))
        if (challenge.get("consumed_at") != null) throw Problems.conflict("challenge_consumed", "La verificación ya fue utilizada.")
        dsl.execute("update dossier_challenge set consumed_at = clock_timestamp() where tenant_id = ? and id = ?", account.tenantId, challengeId)
        try {
            if (!hashMatches(state, challenge.get("state_sha256", String::class.java)) || pkce(verifier) != challenge.get("code_challenge", String::class.java).trim()) throw verificationFailed()
            oidc.verify(code, verifier, account.subject, challenge.get("nonce_sha256", String::class.java), challenge.get("created_at", OffsetDateTime::class.java).toInstant())
            validateChallenge(challenge, versions(account))
            if (!Instant.now().isBefore(Instant.parse(dossier.view.expiresAt))) throw Problems.gone("dossier_expired", "Solicita otro expediente.")
        } catch (failure: ApiException) {
            audit.record(account.tenantId, person, "dossier.verification_failed", "dossier", id)
            throw failure
        }
        val authorization = random()
        val expires = minOf(Instant.now().plusSeconds(60), Instant.parse(dossier.view.expiresAt))
        dsl.execute("insert into dossier_authorization (tenant_id,id,dossier_id,user_id,challenge_id,authorization_sha256,expires_at) values (?,?,?,?,?,?,cast(? as timestamptz))",
            account.tenantId, UUID.randomUUID(), id, account.userId, challengeId, hash(authorization), expires.toString())
        audit.record(account.tenantId, person, "dossier.authorized", "dossier", id)
        return DossierAuthorizationView(authorization, expires.toString())
    }

    @Transactional
    fun download(person: CurrentPerson, id: UUID, request: DossierDownloadRequest): DossierDelivery {
        val account = access.require(person)
        ready(account, id)
        val authorization = strictText("authorization", request.authorization, OPAQUE, 43)
        val row = dsl.fetchOne("select id,challenge_id,expires_at,consumed_at from dossier_authorization where tenant_id = ? and dossier_id = ? and user_id = ? and authorization_sha256 = ? for update",
            account.tenantId, id, account.userId, hash(authorization)) ?: throw verificationFailed()
        if (row.get("consumed_at") != null || !row.get("expires_at", OffsetDateTime::class.java).toInstant().isAfter(Instant.now())) throw Problems.gone("authorization_expired", "Inicia otra verificación.")
        val challenge = dsl.fetchOne("select permission_version,account_version,tenant_version,invalidated_at from dossier_challenge where tenant_id = ? and id = ?", account.tenantId, row.get("challenge_id"))!!
        // El desafío puede haber vencido después del canje; la autorización tiene su propio plazo.
        if (!sameVersions(challenge, versions(account)) || challenge.get("invalidated_at") != null) throw Problems.gone("authorization_expired", "Inicia otra verificación.")
        val file = files.spool { output ->
            dsl.connection { connection ->
                connection.prepareStatement("select content from dossier_chunk where tenant_id = ? and dossier_id = ? order by position").use { statement ->
                    statement.fetchSize = 1; statement.setObject(1, account.tenantId); statement.setObject(2, id)
                    statement.executeQuery().use { chunks -> while (chunks.next()) chunks.getBinaryStream(1).use { it.copyTo(output) } }
                }
            }
        }
        try {
            if (dsl.execute("update dossier set status = 'downloaded' where tenant_id = ? and id = ? and status = 'ready' and expires_at > clock_timestamp()", account.tenantId, id) != 1) throw Problems.gone("dossier_expired", "Solicita otro expediente.")
            if (dsl.execute("update dossier_authorization set consumed_at = clock_timestamp() where tenant_id = ? and id = ? and consumed_at is null and expires_at > clock_timestamp()", account.tenantId, row.get("id")) != 1) throw Problems.gone("authorization_expired", "Inicia otra verificación.")
            audit.record(account.tenantId, person, "dossier.downloaded", "dossier", id)
            return DossierDelivery(id, file)
        } catch (failure: Exception) { files.discard(file); throw failure }
    }

    private fun ready(account: DossierAccount, id: UUID): DossierRow {
        val row = ownedDossier(account, dossiers.find(account.tenantId, id, lock = true) ?: throw Problems.notFound())
        when (row.view.status) {
            "expired" -> throw Problems.gone("dossier_expired", "Solicita otro expediente.")
            "downloaded" -> throw Problems.gone("dossier_downloaded", "El expediente ya se consumió; solicita otro.")
            "ready" -> return row
            else -> throw Problems.conflict("dossier_not_ready", "El expediente todavía no está listo.")
        }
    }
    private fun versions(account: DossierAccount): Record = dsl.fetchOne("select p.version as permission_version,u.dossier_access_version as account_version,t.dossier_access_version as tenant_version from dossier_permission p join tenant_user u on u.tenant_id=p.tenant_id and u.id=p.user_id join tenant t on t.id=p.tenant_id where p.tenant_id=? and p.user_id=?", account.tenantId, account.userId)!!
    private fun sameVersions(challenge: Record, current: Record) = listOf("permission_version", "account_version", "tenant_version").all { challenge.get(it, Long::class.java) == current.get(it, Long::class.java) }
    private fun validateChallenge(challenge: Record, current: Record) {
        if (challenge.get("invalidated_at") != null || !sameVersions(challenge, current) || !challenge.get("expires_at", OffsetDateTime::class.java).toInstant().isAfter(Instant.now())) throw Problems.gone("challenge_expired", "Inicia otra verificación.")
    }
    private fun hash(value: String) = sha256(value.toByteArray(UTF_8))
    private fun random() = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32).also(random::nextBytes))
    companion object {
        private val random = SecureRandom()
        internal val OPAQUE = Regex("^[A-Za-z0-9_-]{43}$")
        private val VERIFIER = Regex("^[A-Za-z0-9._~-]{43,128}$")
    }
}

@RestController
@Profile("!migrate")
@RequestMapping("/api/v1/dossiers")
class DossierVerificationController(private val service: DossierVerification, private val files: DossierDownloadFiles) {
    @PostMapping("/{dossierId}/challenges")
    fun challenge(@AuthenticationPrincipal person: CurrentPerson, @PathVariable dossierId: UUID, @RequestBody request: DossierChallengeRequest): ResponseEntity<DossierChallengeView> =
        ResponseEntity.status(HttpStatus.CREATED).header(HttpHeaders.CACHE_CONTROL, "no-store").body(service.challenge(person, dossierId, request))
    @PostMapping("/{dossierId}/authorizations")
    fun authorize(@AuthenticationPrincipal person: CurrentPerson, @PathVariable dossierId: UUID, @RequestBody request: DossierAuthorizationRequest): ResponseEntity<DossierAuthorizationView> =
        ResponseEntity.status(HttpStatus.CREATED).header(HttpHeaders.CACHE_CONTROL, "no-store").body(service.authorize(person, dossierId, request))
    @PostMapping("/{dossierId}/download")
    fun download(@AuthenticationPrincipal person: CurrentPerson, @PathVariable dossierId: UUID, @RequestBody request: DossierDownloadRequest, @RequestHeader("Range", required = false) range: String?): ResponseEntity<StreamingResponseBody> {
        if (range != null) throw Problems.validation("Range", "unsupported", "La descarga no admite reanudación.")
        val delivery = service.download(person, dossierId, request)
        val stream = StreamingResponseBody { output -> files.stream(delivery.path, output) }
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").header(HttpHeaders.ACCEPT_RANGES, "none")
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expediente-${delivery.id}.zip\"").header(HttpHeaders.CONTENT_TYPE, "application/zip").body(stream)
    }
}
