package mx.fastsolution.zenit.device

import com.nimbusds.jose.JWSObject
import jakarta.servlet.http.HttpServletRequest
import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.capture.CaptureProperties
import mx.fastsolution.zenit.capture.FixedWindowLimiter
import mx.fastsolution.zenit.employee.EmployeeRepository
import mx.fastsolution.zenit.identity.CurrentPerson
import mx.fastsolution.zenit.site.SiteRepository
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
import java.security.MessageDigest
import java.security.SecureRandom
import java.text.ParseException
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID

data class DeviceRow(
    val tenantId: UUID,
    val id: UUID,
    val mode: String,
    val status: String,
    val employeeId: UUID?,
    val siteId: UUID?,
    val label: String?,
    val publicJwk: String,
    val model: String,
    val appVersion: String,
    val enrolledAt: OffsetDateTime,
    val lastSeenAt: OffsetDateTime?,
    val revokedAt: OffsetDateTime?,
)

data class EnrollmentRow(
    val tenantId: UUID,
    val id: UUID,
    val mode: String,
    val employeeId: UUID?,
    val siteId: UUID?,
    val label: String?,
    val status: String,
    val expiresAt: OffsetDateTime,
    val createdAt: OffsetDateTime,
)

data class SessionRow(val id: UUID, val deviceId: UUID, val startedAt: OffsetDateTime, val endedAt: OffsetDateTime?)

class DeviceEnrollmentRequest {
    var mode: String? = null
    var employeeId: String? = null
    var siteId: String? = null
    var label: String? = null
}

class DeviceInfoRequest {
    var manufacturer: String? = null
    var model: String? = null
    var androidSdk: Int? = null
    var appVersion: String? = null
}

class DeviceActivationRequest {
    var enrollmentCode: String? = null
    var publicKey: Map<String, Any?>? = null
    var proof: String? = null
    var device: DeviceInfoRequest? = null
    var screenLock: Boolean? = null
    var integrityToken: String? = null
}

class DeviceRevocationRequest {
    var reason: String? = null
}

class DeviceSessionRequest {
    var appVersion: String? = null
}

data class DeviceEnrollmentView(
    val id: String,
    val mode: String,
    val employeeId: String?,
    val siteId: String?,
    val label: String?,
    /** Sólo aparece aquí: el servidor guarda su huella, no el código. */
    val code: String,
    val status: String,
    val expiresAt: String,
    val createdAt: String,
)

data class DeviceView(
    val id: String,
    val mode: String,
    val status: String,
    val employeeId: String?,
    val siteId: String?,
    val label: String?,
    val model: String,
    val appVersion: String,
    val enrolledAt: String,
    val lastSeenAt: String?,
    val revokedAt: String?,
) {
    companion object {
        fun of(row: DeviceRow) = DeviceView(
            row.id.toString(), row.mode, row.status, row.employeeId?.toString(), row.siteId?.toString(), row.label, row.model,
            row.appVersion, row.enrolledAt.toInstant().toString(), row.lastSeenAt?.toInstant()?.toString(),
            row.revokedAt?.toInstant()?.toString(),
        )
    }
}

data class OfflinePolicyView(val maxAgeHours: Long, val maxEvents: Int)

data class DeviceSessionView(
    val sessionId: String,
    val startedAt: String,
    val serverTime: String,
    val tokenMaxAgeSeconds: Long,
    val locationReuseSeconds: Int,
    val breakPolicy: String,
    val offlinePolicy: OfflinePolicyView,
)

data class NamedTenantView(val name: String, val timeZone: String)

data class NamedEmployeeView(val id: String, val displayName: String)

data class NamedSiteView(val id: String, val name: String)

data class DeviceActivationView(
    val deviceId: String,
    val mode: String,
    val tenant: NamedTenantView,
    val employee: NamedEmployeeView?,
    val site: NamedSiteView?,
    val audience: String,
    val session: DeviceSessionView,
)

@Repository
class DeviceRepository(private val dsl: DSLContext) {
    fun insertEnrollment(tenantId: UUID, id: UUID, mode: String, employeeId: UUID?, siteId: UUID?, label: String?, codeHash: String, expiresAt: OffsetDateTime, createdBy: String) {
        dsl.execute(
            "insert into device_enrollment (tenant_id, id, mode, employee_id, site_id, label, code_sha256, status, expires_at, created_by) " +
                "values (?, ?, ?, cast(? as uuid), cast(? as uuid), cast(? as text), ?, 'pending', cast(? as timestamptz), ?)",
            tenantId, id, mode, employeeId, siteId, label, codeHash, expiresAt, createdBy,
        )
    }

    fun findEnrollment(tenantId: UUID, id: UUID): EnrollmentRow? =
        dsl.fetchOne("$ENROLLMENT where tenant_id = ? and id = ?", tenantId, id)?.let(::enrollment)

    /** Por la huella del código: es lo único que trae quien activa. Bloquea la fila hasta terminar. */
    fun lockEnrollmentByCode(codeHash: String): EnrollmentRow? =
        dsl.fetchOne("$ENROLLMENT where code_sha256 = ? for update", codeHash)?.let(::enrollment)

    fun setEnrollmentStatus(tenantId: UUID, id: UUID, status: String) {
        dsl.execute(
            "update device_enrollment set status = ?, used_at = case when ? = 'used' then now() else used_at end " +
                "where tenant_id = ? and id = ?",
            status, status, tenantId, id,
        )
    }

    fun thumbprintTaken(thumbprint: String): Boolean =
        dsl.fetchOne("select 1 as found from device where key_thumbprint = ?", thumbprint) != null

    fun insert(tenantId: UUID, id: UUID, e: EnrollmentRow, publicJwk: String, thumbprint: String, info: DeviceInfoRequest) {
        dsl.execute(
            "insert into device (tenant_id, id, mode, status, employee_id, site_id, label, public_jwk, key_thumbprint, " +
                "manufacturer, model, android_sdk, app_version) " +
                "values (?, ?, ?, 'active', cast(? as uuid), cast(? as uuid), cast(? as text), cast(? as jsonb), ?, ?, ?, ?, ?)",
            tenantId, id, e.mode, e.employeeId, e.siteId, e.label, publicJwk, thumbprint,
            info.manufacturer, info.model, info.androidSdk, info.appVersion,
        )
    }

    fun find(tenantId: UUID, id: UUID): DeviceRow? = dsl.fetchOne("$DEVICE where tenant_id = ? and id = ?", tenantId, id)?.let(::device)

    /** La única búsqueda sin empresa: de ella sale la empresa del dispositivo que llama. */
    fun findForAuthentication(id: UUID): DeviceRow? = dsl.fetchOne("$DEVICE where id = ?", id)?.let(::device)

    fun page(tenantId: UUID, mode: String?, status: String?, after: PageKey?, limit: Int): List<DeviceRow> {
        val sql = StringBuilder("$DEVICE where tenant_id = ?")
        val binds = mutableListOf<Any>(tenantId)
        if (mode != null) {
            sql.append(" and mode = ?")
            binds += mode
        }
        if (status != null) {
            sql.append(" and status = ?")
            binds += status
        }
        if (after != null) {
            sql.append(" and (enrolled_at, id) > (cast(? as timestamptz), cast(? as uuid))")
            binds += after.at
            binds += after.id
        }
        sql.append(" order by enrolled_at, id limit ?")
        binds += limit
        return dsl.fetch(sql.toString(), *binds.toTypedArray()).map { device(it) }
    }

    /** Cierra el teléfono personal anterior de esa persona, si lo había. */
    fun replaceActivePersonal(tenantId: UUID, employeeId: UUID): List<UUID> =
        dsl.fetch(
            "update device set status = 'replaced', revoked_at = now() " +
                "where tenant_id = ? and employee_id = ? and mode = 'personal' and status = 'active' returning id",
            tenantId, employeeId,
        ).map { it.get("id", UUID::class.java) }

    fun revoke(tenantId: UUID, id: UUID) {
        dsl.execute("update device set status = 'revoked', revoked_at = now() where tenant_id = ? and id = ?", tenantId, id)
    }

    fun touch(tenantId: UUID, id: UUID, appVersion: String?) {
        dsl.execute(
            "update device set last_seen_at = now(), app_version = coalesce(cast(? as text), app_version) where tenant_id = ? and id = ?",
            appVersion, tenantId, id,
        )
    }

    fun closeSessions(tenantId: UUID, deviceId: UUID) {
        dsl.execute("update device_session set ended_at = now() where tenant_id = ? and device_id = ? and ended_at is null", tenantId, deviceId)
    }

    fun openSession(tenantId: UUID, id: UUID, deviceId: UUID, appVersion: String): SessionRow {
        val r = dsl.fetchOne(
            "insert into device_session (tenant_id, id, device_id, app_version) values (?, ?, ?, ?) returning started_at",
            tenantId, id, deviceId, appVersion,
        )!!
        return SessionRow(id, deviceId, r.get("started_at", OffsetDateTime::class.java), null)
    }

    fun findSession(tenantId: UUID, deviceId: UUID, id: UUID): SessionRow? =
        dsl.fetchOne(
            "select id, device_id, started_at, ended_at from device_session where tenant_id = ? and device_id = ? and id = ?",
            tenantId, deviceId, id,
        )?.let {
            SessionRow(
                it.get("id", UUID::class.java), it.get("device_id", UUID::class.java),
                it.get("started_at", OffsetDateTime::class.java), it.get("ended_at", OffsetDateTime::class.java),
            )
        }

    private fun enrollment(r: Record) = EnrollmentRow(
        tenantId = r.get("tenant_id", UUID::class.java),
        id = r.get("id", UUID::class.java),
        mode = r.get("mode", String::class.java),
        employeeId = r.get("employee_id", UUID::class.java),
        siteId = r.get("site_id", UUID::class.java),
        label = r.get("label", String::class.java),
        status = r.get("status", String::class.java),
        expiresAt = r.get("expires_at", OffsetDateTime::class.java),
        createdAt = r.get("created_at", OffsetDateTime::class.java),
    )

    private fun device(r: Record) = DeviceRow(
        tenantId = r.get("tenant_id", UUID::class.java),
        id = r.get("id", UUID::class.java),
        mode = r.get("mode", String::class.java),
        status = r.get("status", String::class.java),
        employeeId = r.get("employee_id", UUID::class.java),
        siteId = r.get("site_id", UUID::class.java),
        label = r.get("label", String::class.java),
        publicJwk = r.get("public_jwk", String::class.java),
        model = r.get("model", String::class.java),
        appVersion = r.get("app_version", String::class.java),
        enrolledAt = r.get("enrolled_at", OffsetDateTime::class.java),
        lastSeenAt = r.get("last_seen_at", OffsetDateTime::class.java),
        revokedAt = r.get("revoked_at", OffsetDateTime::class.java),
    )

    private companion object {
        const val ENROLLMENT =
            "select tenant_id, id, mode, employee_id, site_id, label, status, expires_at, created_at from device_enrollment"
        const val DEVICE =
            "select tenant_id, id, mode, status, employee_id, site_id, label, cast(public_jwk as text) as public_jwk, " +
                "model, app_version, enrolled_at, last_seen_at, revoked_at from device"
    }
}

/** Códigos de enrolamiento: de un solo uso, fáciles de teclear y sin caracteres que se confundan. */
object EnrollmentCodes {
    private const val ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"
    private const val HALF = 5
    private val random = SecureRandom()

    fun generate(): String {
        val chars = (1..HALF * 2).map { ALPHABET[random.nextInt(ALPHABET.length)] }.joinToString("")
        return chars.take(HALF) + "-" + chars.drop(HALF)
    }

    /** Quien lo teclea puede cambiar mayúsculas, espacios o el guion. */
    fun normalize(code: String): String = code.uppercase().filter { it.isLetterOrDigit() }

    fun hash(code: String): String =
        MessageDigest.getInstance("SHA-256").digest(normalize(code).toByteArray()).joinToString("") { "%02x".format(it) }
}

@Service
class DeviceService(
    private val devices: DeviceRepository,
    private val employees: EmployeeRepository,
    private val sites: SiteRepository,
    private val tenants: TenantRepository,
    private val capture: CaptureProperties,
    private val audit: AuditLog,
) {
    private val activationFailures = FixedWindowLimiter(Duration.ofMinutes(1))

    /** La modalidad se fija aquí: un teléfono personal se liga a una persona y una terminal a una sede. */
    @Transactional
    fun enroll(person: CurrentPerson, request: DeviceEnrollmentRequest): Pair<EnrollmentRow, String> {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val mode = checks.oneOf("mode", request.mode, MODES, required = true)
        val employeeId = checks.uuid("employeeId", request.employeeId, required = mode == "personal")
        val siteId = checks.uuid("siteId", request.siteId, required = mode == "terminal")
        val label = checks.text("label", request.label, MAX_LABEL, required = false)
        if (mode == "personal" && request.siteId != null) checks.fail("siteId", "not_allowed", "Un teléfono personal no se liga a una sede.")
        if (mode == "terminal" && request.employeeId != null) checks.fail("employeeId", "not_allowed", "Una terminal no se liga a una persona.")
        checks.done()
        if (mode == "personal") {
            val employee = employees.find(tenantId, employeeId!!)
            when {
                employee == null -> checks.fail("employeeId", "employee_not_found", "La persona no existe.")
                employee.status != "active" -> checks.fail("employeeId", "employee_inactive", "La persona está dada de baja.")
            }
        } else {
            val site = sites.find(tenantId, siteId!!)
            when {
                site == null -> checks.fail("siteId", "site_not_found", "La sede no existe.")
                site.status != "active" -> checks.fail("siteId", "site_inactive", "La sede está desactivada.")
            }
        }
        checks.done()

        val code = EnrollmentCodes.generate()
        val id = UUID.randomUUID()
        devices.insertEnrollment(
            tenantId, id, mode!!, employeeId, siteId, label, EnrollmentCodes.hash(code),
            OffsetDateTime.now().plusMinutes(capture.enrollmentTtlMinutes), person.actorId,
        )
        audit.record(tenantId, person, "device.enrollment_created", "device_enrollment", id, mapOf("mode" to mode))
        return devices.findEnrollment(tenantId, id)!! to code
    }

    /**
     * Canjea el código y registra la clave pública. No lleva credencial: lo
     * autoriza el código de un solo uso, y `proof` demuestra que quien llama
     * posee la clave privada que registra.
     */
    @Transactional(noRollbackFor = [ActivationRefused::class])
    fun activate(request: DeviceActivationRequest, remoteAddress: String): DeviceActivationView {
        if (activationFailures.exhausted(remoteAddress, capture.activationFailuresPerMinute)) throw Problems.rateLimited()
        val checks = Checks()
        val code = request.enrollmentCode
        if (code == null || code.length !in MIN_CODE..MAX_CODE) checks.fail("enrollmentCode", "invalid_code", "Lleva de $MIN_CODE a $MAX_CODE caracteres.")
        val key = request.publicKey?.let(DeviceKeys::parsePublic)
        if (key == null) checks.fail("publicKey", "invalid_key", "Debe ser una clave pública P-256 en formato JWK.")
        val proof = request.proof?.takeIf { COMPACT_JWS.matches(it) }
        if (proof == null) checks.fail("proof", "invalid_proof", "Debe ser un JWS compacto.")
        val info = request.device
        if (info == null) {
            checks.fail("device", "required", "Es obligatorio.")
        } else {
            checks.text("device.manufacturer", info.manufacturer, MAX_INFO, required = true)
            checks.text("device.model", info.model, MAX_INFO, required = true)
            checks.whole("device.androidSdk", info.androidSdk, MIN_SDK, Int.MAX_VALUE, required = true)
            checks.text("device.appVersion", info.appVersion, MAX_VERSION, required = true)
        }
        when (request.screenLock) {
            null -> checks.fail("screenLock", "required", "Es obligatorio.")
            false -> checks.fail("screenLock", "screen_lock_required", "El dispositivo debe tener bloqueo de pantalla.")
            else -> Unit
        }
        checks.done()

        // La firma debe estar hecha con la clave que se registra y sobre este mismo código.
        val signedCode = try {
            val jws = JWSObject.parse(proof!!)
            if (DeviceKeys.verify(jws, key!!)) jws.payload.toJSONObject()?.get("enrollmentCode") as? String else null
        } catch (e: ParseException) {
            null
        }
        if (signedCode == null || EnrollmentCodes.normalize(signedCode) != EnrollmentCodes.normalize(code!!)) {
            throw Problems.validation("proof", "invalid_proof", "La prueba no está firmada con esa clave o no corresponde al código.")
        }

        val enrollment = devices.lockEnrollmentByCode(EnrollmentCodes.hash(code))
        if (enrollment != null && enrollment.status == "pending" && enrollment.expiresAt <= OffsetDateTime.now()) {
            devices.setEnrollmentStatus(enrollment.tenantId, enrollment.id, "expired")
        }
        val tenant = enrollment?.let { tenants.find(it.tenantId) }
        val employee = if (enrollment?.employeeId != null) employees.find(enrollment.tenantId, enrollment.employeeId) else null
        val site = if (enrollment?.siteId != null) sites.find(enrollment.tenantId, enrollment.siteId) else null
        val usable = enrollment != null && enrollment.status == "pending" && enrollment.expiresAt > OffsetDateTime.now() &&
            tenant?.status == "active" && (employee == null || employee.status == "active") && (site == null || site.status == "active")
        if (!usable) {
            // Un código inexistente, usado o vencido responde igual, y cuenta para la cuota.
            activationFailures.tryAcquire(remoteAddress, capture.activationFailuresPerMinute)
            throw ActivationRefused()
        }
        checkNotNull(enrollment)
        val thumbprint = key!!.computeThumbprint().toString()
        if (devices.thumbprintTaken(thumbprint)) {
            throw Problems.validation("publicKey", "key_already_registered", "Esa clave ya pertenece a un dispositivo.")
        }

        val tenantId = enrollment.tenantId
        if (enrollment.mode == "personal") {
            // El teléfono nuevo de una persona cierra el anterior en la misma transacción.
            devices.replaceActivePersonal(tenantId, enrollment.employeeId!!).forEach { devices.closeSessions(tenantId, it) }
        }
        val deviceId = UUID.randomUUID()
        devices.insert(tenantId, deviceId, enrollment, key.toPublicJWK().toJSONString(), thumbprint, info!!)
        devices.setEnrollmentStatus(tenantId, enrollment.id, "used")
        val session = devices.openSession(tenantId, UUID.randomUUID(), deviceId, info.appVersion!!)
        audit.record(
            tenantId, "device", deviceId.toString(), "device.activated", "device", deviceId,
            mapOf("mode" to enrollment.mode, "enrollmentId" to enrollment.id.toString()),
        )
        return DeviceActivationView(
            deviceId = deviceId.toString(),
            mode = enrollment.mode,
            tenant = NamedTenantView(tenant!!.name, tenant.timeZone),
            employee = employee?.let { NamedEmployeeView(it.id.toString(), it.displayName) },
            site = site?.let { NamedSiteView(it.id.toString(), it.name) },
            audience = capture.audience,
            session = sessionView(session, enrollment.mode, tenant.breakPolicy),
        )
    }

    @Transactional(readOnly = true)
    fun page(person: CurrentPerson, mode: String?, status: String?, after: PageKey?, limit: Int): List<DeviceRow> {
        val checks = Checks()
        checks.oneOf("mode", mode, MODES, required = false)
        checks.oneOf("status", status, STATUSES, required = false)
        checks.done()
        return devices.page(person.requireTenant(), mode, status, after, limit + 1)
    }

    /** Invalida la clave del dispositivo. Sus marcajes anteriores se conservan. */
    @Transactional
    fun revoke(person: CurrentPerson, id: UUID, request: DeviceRevocationRequest): DeviceRow {
        val tenantId = person.requireTenant()
        val checks = Checks()
        val reason = checks.text("reason", request.reason, MAX_REASON, required = true)
        if (reason != null && reason.length < MIN_REASON) checks.fail("reason", "too_short", "Lleva al menos $MIN_REASON caracteres.")
        checks.done()

        val device = devices.find(tenantId, id) ?: throw Problems.notFound()
        if (device.status != "active") throw Problems.conflict("device_not_active", "El dispositivo ya no está activo.")
        devices.revoke(tenantId, id)
        devices.closeSessions(tenantId, id)
        audit.record(tenantId, person, "device.revoked", "device", id, mapOf("reason" to reason!!))
        return devices.find(tenantId, id)!!
    }

    /** Abre una sesión de captura y cierra la anterior del mismo dispositivo. */
    @Transactional
    fun openSession(device: CurrentDevice, request: DeviceSessionRequest): DeviceSessionView {
        val checks = Checks()
        val appVersion = checks.text("appVersion", request.appVersion, MAX_VERSION, required = true)
        checks.done()
        val tenant = tenants.find(device.tenantId) ?: throw Problems.forbidden()
        devices.closeSessions(device.tenantId, device.id)
        val session = devices.openSession(device.tenantId, UUID.randomUUID(), device.id, appVersion!!)
        devices.touch(device.tenantId, device.id, appVersion)
        return sessionView(session, device.mode, tenant.breakPolicy)
    }

    private fun sessionView(session: SessionRow, mode: String, breakPolicy: String) = DeviceSessionView(
        sessionId = session.id.toString(),
        startedAt = session.startedAt.toInstant().toString(),
        serverTime = Instant.now().toString(),
        tokenMaxAgeSeconds = capture.tokenMaxAgeSeconds,
        // Sólo una terminal reutiliza la ubicación entre lecturas seguidas.
        locationReuseSeconds = if (mode == "terminal") capture.terminalLocationReuseSeconds else 0,
        breakPolicy = breakPolicy,
        offlinePolicy = OfflinePolicyView(capture.offlineMaxAgeHours, capture.offlineMaxEvents),
    )

    private companion object {
        val MODES = setOf("personal", "terminal")
        val STATUSES = setOf("active", "revoked", "replaced")
        val COMPACT_JWS = Regex("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$")
        const val MAX_LABEL = 60
        const val MIN_CODE = 6
        const val MAX_CODE = 32
        const val MAX_INFO = 60
        const val MAX_VERSION = 20
        const val MIN_SDK = 28
        const val MIN_REASON = 5
        const val MAX_REASON = 280
    }
}

/** El código no existe, ya se usó o venció. La respuesta no dice cuál. */
class ActivationRefused : RuntimeException()

@RestController
@RequestMapping("/api/v1")
class DeviceController(private val service: DeviceService) {
    @PostMapping("/device-enrollments")
    @ResponseStatus(HttpStatus.CREATED)
    fun enroll(@AuthenticationPrincipal person: CurrentPerson, @RequestBody request: DeviceEnrollmentRequest): DeviceEnrollmentView {
        val (row, code) = service.enroll(person, request)
        return DeviceEnrollmentView(
            row.id.toString(), row.mode, row.employeeId?.toString(), row.siteId?.toString(), row.label, code, row.status,
            row.expiresAt.toInstant().toString(), row.createdAt.toInstant().toString(),
        )
    }

    @PostMapping("/device-activations")
    @ResponseStatus(HttpStatus.CREATED)
    fun activate(@RequestBody request: DeviceActivationRequest, http: HttpServletRequest): DeviceActivationView = try {
        service.activate(request, http.remoteAddr)
    } catch (e: ActivationRefused) {
        throw Problems.gone("enrollment_gone", "El código ya se usó, venció o no existe.")
    }

    @GetMapping("/devices")
    fun list(
        @AuthenticationPrincipal person: CurrentPerson,
        @RequestParam mode: String?,
        @RequestParam status: String?,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<DeviceView> {
        val size = Paging.limit(limit)
        val rows = service.page(person, mode, status, Paging.decode(cursor), size)
        return Paging.page(rows, size, { PageKey(it.enrolledAt, it.id) }) { DeviceView.of(it) }
    }

    @PostMapping("/devices/{deviceId}/revocation")
    fun revoke(
        @AuthenticationPrincipal person: CurrentPerson,
        @PathVariable deviceId: UUID,
        @RequestBody request: DeviceRevocationRequest,
    ): DeviceView = DeviceView.of(service.revoke(person, deviceId, request))

    @PostMapping("/device-sessions")
    @ResponseStatus(HttpStatus.CREATED)
    fun openSession(@AuthenticationPrincipal device: CurrentDevice, @RequestBody request: DeviceSessionRequest): DeviceSessionView =
        service.openSession(device, request)
}
