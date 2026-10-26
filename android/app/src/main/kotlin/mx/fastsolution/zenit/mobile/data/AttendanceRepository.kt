package mx.fastsolution.zenit.mobile.data

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.room.withTransaction
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import mx.fastsolution.zenit.mobile.BuildConfig
import mx.fastsolution.zenit.mobile.capture.SessionPolicy
import mx.fastsolution.zenit.mobile.capture.TagEvidenceHasher
import mx.fastsolution.zenit.mobile.location.CurrentLocationProvider
import mx.fastsolution.zenit.mobile.security.DeviceSigner
import mx.fastsolution.zenit.mobile.security.OfflineEventCipher
import org.json.JSONArray
import org.json.JSONObject

class AttendanceRepository(private val context: Context) {
    private val database = AttendanceDatabase.get(context)
    private val dao = database.pendingAttendanceDao()
    val store = DeviceStore(context)
    private val cipher = OfflineEventCipher()
    val pendingCount: Flow<Int> = dao.observePendingCount()
    val legacyCount: Flow<Int> = dao.observeLegacyCount()
    val receipts = dao.observeReceipts()

    suspend fun personalWeek(date: String): JSONObject = withContext(Dispatchers.IO) {
        lock.withLock {
            val registration = requireRegistration()
            check(registration.getString("mode") == "personal") { "La terminal no consulta semanas personales." }
            val day = java.time.LocalDate.parse(date)
            val week = CaptureApi(registration.getString("baseUrl")).get("/me/attendance?week=$day", signer(registration).assertion(registration))
            week.optJSONObject("closure")?.let { closure ->
                if (closure.getString("status") == "closed") {
                    val receipt = if (week.has("acknowledgement")) week.optJSONObject("acknowledgement")
                        else store.acknowledgement(registration.getString("deviceId"), closure.getString("id"))
                    receipt?.let {
                        check(it.getString("closureId") == closure.getString("id")) { "El acuse no corresponde a esta versión del cierre." }
                        week.put("_localAcknowledgement", it)
                    }
                }
            }
            week
        }
    }

    suspend fun acknowledgeWeek(closureId: String, type: String, note: String): JSONObject = withContext(Dispatchers.IO) {
        lock.withLock {
            val registration = requireRegistration()
            check(registration.getString("mode") == "personal") { "La terminal no puede enviar un acuse personal." }
            val id = UUID.fromString(closureId)
            require(type in setOf("agreed", "objected") && note.length <= 500)
            check(type != "agreed" || dao.pendingCount() == 0) { "Sincronice los marcajes pendientes antes de expresar conformidad." }
            val body = JSONObject().put("type", type)
            if (note.isNotBlank()) body.put("note", note.trim())
            val receipt = CaptureApi(registration.getString("baseUrl")).post("/week-closures/$id/acknowledgements", body, signer(registration).assertion(registration))
            check(receipt.getString("closureId") == id.toString() && receipt.getString("type") == type) { "El acuse no corresponde al cierre enviado." }
            UUID.fromString(receipt.getString("id"))
            Instant.parse(receipt.getString("at"))
            check(receipt.getString("evidenceHash").isNotBlank()) { "El acuse no contiene su referencia de evidencia." }
            store.saveAcknowledgement(registration.getString("deviceId"), id.toString(), receipt)
            receipt
        }
    }

    suspend fun activate(baseUrl: String, enrollmentCode: String, preservePreviousPending: Boolean = false) = withContext(Dispatchers.IO) {
        lock.withLock {
            check(!syncLock.isLocked) { "Espere a que termine la sincronización antes de volver a enrolar." }
            check(dao.pendingCount() == 0 || preservePreviousPending) { "Sincronice los pendientes o confirme que se conserven sin enviar antes de volver a enrolar." }
            val base = CaptureApi.validateBaseUrl(baseUrl)
            val code = enrollmentCode.trim().uppercase(java.util.Locale.ROOT)
            require(code.length in 6..32) { "Revise el código de activación proporcionado por Recursos Humanos." }
            val screenLock = ContextCompat.getSystemService(context, KeyguardManager::class.java)?.isDeviceSecure == true
            check(screenLock) { "Active el bloqueo de pantalla del teléfono antes de enrolarlo." }
            val signer = DeviceSigner.create()
            val body = JSONObject().put("enrollmentCode", code).put("publicKey", signer.publicJwk())
                .put("proof", signer.sign(JSONObject().put("enrollmentCode", code)))
                .put("screenLock", screenLock).put("device", JSONObject().put("manufacturer", Build.MANUFACTURER)
                    .put("model", Build.MODEL).put("androidSdk", Build.VERSION.SDK_INT).put("appVersion", BuildConfig.VERSION_NAME))
            val registration = CaptureApi(base).post("/device-activations", body)
            UUID.fromString(registration.getString("deviceId"))
            require(registration.getString("mode") in setOf("personal", "terminal"))
            require(registration.getString("audience").isNotBlank())
            val tenant = registration.getJSONObject("tenant")
            require(tenant.getString("name").isNotBlank())
            ZoneId.of(tenant.getString("timeZone"))
            validateSession(registration.getJSONObject("session"))
            registration.put("baseUrl", base).put("keyAlias", signer.alias).put("nextSequence", 1)
            if (preservePreviousPending) dao.preservePreviousPending()
            store.saveRegistration(registration)
            store.saveNotice("Dispositivo activado. Aproxime una tarjeta NFC al lector.")
        }
    }

    suspend fun renewSession() = withContext(Dispatchers.IO) {
        lock.withLock {
            check(!syncLock.isLocked) { "Espere a que termine la sincronización antes de renovar la sesión." }
            check(dao.pendingCount() == 0) { "Sincronice los marcajes pendientes antes de renovar la sesión." }
            val registration = requireRegistration()
            val session = CaptureApi(registration.getString("baseUrl")).post("/device-sessions",
                JSONObject().put("appVersion", BuildConfig.VERSION_NAME), signer(registration).assertion(registration))
            validateSession(session)
            registration.put("session", session).put("nextSequence", 1)
            store.saveRegistration(registration)
            store.saveNotice("Sesión renovada. Aproxime una tarjeta NFC al lector.")
        }
    }

    suspend fun capture(tagId: ByteArray, declaredType: String?, observedAt: Instant, elapsedRealtimeMs: Long) = withContext(Dispatchers.IO) {
        lock.withLock {
            check(BuildConfig.DEBUG) { "La verificación de tarjetas reales todavía no está disponible." }
            val registration = requireRegistration()
            check(sessionUsable(registration, observedAt)) { "La sesión venció o alcanzó su límite. Sincronice y renueva la sesión." }
            check(ContextCompat.getSystemService(context, KeyguardManager::class.java)?.isDeviceSecure == true) { "Active el bloqueo de pantalla para marcar." }
            val session = registration.getJSONObject("session")
            require(declaredType == null || declaredType in setOf("clock_in", "clock_out") ||
                (session.getString("breakPolicy") == "marked" && declaredType in setOf("break_start", "break_end")))
            val sequence = registration.getInt("nextSequence")
            // Reservar antes de insertar evita repetir un consecutivo tras un cierre inesperado.
            registration.put("nextSequence", sequence + 1)
            store.saveRegistration(registration)
            val id = UUID.randomUUID().toString()
            val locationProvider = CurrentLocationProvider(context)
            val location = locationProvider.capture()
            val payload = JSONObject().put("envelopeVersion", 1).put("idempotencyKey", id)
                .put("sessionId", session.getString("sessionId")).put("sequence", sequence)
                .put("observedAt", observedAt.toString()).put("timeZone", ZoneId.systemDefault().id)
                .put("elapsedRealtimeMs", elapsedRealtimeMs)
                .put("card", JSONObject().put("scheme", "uid_sha256").put("proof", TagEvidenceHasher.sha256(tagId)))
                .put("app", JSONObject().put("version", BuildConfig.VERSION_NAME))
            if (declaredType != null) payload.put("declaredType", declaredType)
            if (location != null) {
                payload.put("location", JSONObject().put("latitude", location.latitude).put("longitude", location.longitude)
                    .put("accuracyMeters", location.accuracyMeters.toDouble()).put("capturedAt", Instant.ofEpochMilli(location.capturedAtEpochMillis).toString())
                    .put("provider", location.provider).put("mock", location.mock))
            } else {
                payload.put("location", JSONObject.NULL).put("locationUnavailableReason", locationProvider.unavailableReason())
            }
            val envelope = signer(registration).sign(payload, registration.getString("deviceId"))
            val encrypted = cipher.encrypt(envelope.toByteArray(Charsets.UTF_8))
            dao.insert(PendingAttendanceEvent(id, encrypted.ciphertext, encrypted.initializationVector, observedAt.toEpochMilli()))
            store.saveNotice("Marcaje firmado y guardado${if (location == null) " sin ubicación" else ""}. Pendiente de confirmación.")
        }
    }

    suspend fun synchronize() = withContext(Dispatchers.IO) {
        syncLock.withLock {
            val registration = lock.withLock { store.registration() } ?: return@withLock
            val api = CaptureApi(registration.getString("baseUrl"))
            repeat(10) {
                val pending = dao.nextPending(100)
                if (pending.isEmpty()) return@withLock
                val envelopes = pending.map { cipher.decrypt(it.encryptedPayload, it.initializationVector).toString(Charsets.UTF_8) }
                val result = api.post("/attendance-events/batch", JSONObject().put("envelopes", JSONArray(envelopes)), signer(registration).assertion(registration))
                val receipts = result.getJSONArray("receipts")
                check(receipts.length() == pending.size) { "El servidor devolvió un lote incompleto. Se conserva la cola." }
                val encrypted = pending.indices.map { index ->
                    val receipt = receipts.getJSONObject(index)
                    val outcome = receipt.getString("outcome")
                    check(outcome in setOf("accepted", "accepted_with_incident", "rejected")) { "El servidor devolvió un recibo no válido. Se conserva la cola." }
                    val key = receipt.getString("idempotencyKey")
                    // Los rechazos de sobres ilegibles usan la clave cero; el contrato conserva su orden.
                    check(key == pending[index].id || (outcome == "rejected" && key == UUID(0, 0).toString())) {
                        "El recibo no corresponde al marcaje. Se conserva la cola."
                    }
                    Instant.parse(receipt.getString("observedAt"))
                    if (outcome == "rejected") {
                        receipt.getJSONObject("rejection").getString("code")
                        receipt.getJSONObject("rejection").getString("message")
                    } else {
                        require(receipt.getString("type") in setOf("clock_in", "clock_out", "break_start", "break_end"))
                        require(receipt.getJSONObject("employee").getString("displayName").isNotBlank())
                    }
                    outcome to cipher.encrypt(receipt.toString().toByteArray(Charsets.UTF_8))
                }
                database.withTransaction {
                    pending.indices.forEach { index ->
                        val (outcome, encryptedReceipt) = encrypted[index]
                        dao.complete(pending[index].id, outcome, encryptedReceipt.ciphertext, encryptedReceipt.initializationVector)
                    }
                }
                val rejected = encrypted.count { it.first == "rejected" }
                store.saveNotice("Recibidos: ${pending.size - rejected}. Rechazados: $rejected. Consulte los recibos recientes.")
            }
        }
    }

    fun readReceipt(event: PendingAttendanceEvent): String {
        val receipt = JSONObject(cipher.decrypt(requireNotNull(event.encryptedReceipt), requireNotNull(event.receiptInitializationVector)).toString(Charsets.UTF_8))
        val zone = store.registration()?.getJSONObject("tenant")?.getString("timeZone") ?: ZoneId.systemDefault().id
        val time = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", java.util.Locale.forLanguageTag("es-MX"))
            .withZone(ZoneId.of(zone)).format(Instant.parse(receipt.getString("observedAt")))
        if (receipt.getString("outcome") == "rejected") {
            val rejection = receipt.getJSONObject("rejection")
            return "$time · Rechazado: ${rejection.getString("message")} (${rejection.getString("code")})"
        }
        val label = when (receipt.getString("type")) {
            "clock_in" -> "Entrada"
            "clock_out" -> "Salida"
            "break_start" -> "Inicio de descanso"
            else -> "Fin de descanso"
        }
        return "$time · ${receipt.getJSONObject("employee").getString("displayName")} · $label${if (receipt.getString("outcome") == "accepted_with_incident") " · Requiere revisión" else " · Confirmado"}"
    }

    fun belongsToDevice(event: PendingAttendanceEvent, deviceId: String?): Boolean {
        if (deviceId == null) return false
        val envelope = cipher.decrypt(event.encryptedPayload, event.initializationVector).toString(Charsets.UTF_8)
        val header = JSONObject(java.util.Base64.getUrlDecoder().decode(envelope.substringBefore('.')).toString(Charsets.UTF_8))
        return header.getString("kid") == deviceId
    }

    private fun requireRegistration() = checkNotNull(store.registration()) { "Enrola el dispositivo antes de marcar." }
    private fun signer(registration: JSONObject) = DeviceSigner(registration.getString("keyAlias"))
    private fun validateSession(session: JSONObject) {
        UUID.fromString(session.getString("sessionId"))
        Instant.parse(session.getString("startedAt"))
        require(session.getInt("tokenMaxAgeSeconds") > 0)
        require(session.getString("breakPolicy") in setOf("marked", "not_considered"))
        val policy = session.getJSONObject("offlinePolicy")
        require(policy.getLong("maxAgeHours") in 1..72 && policy.getInt("maxEvents") in 1..1000)
    }

    companion object {
        private val lock = Mutex()
        private val syncLock = Mutex()
        fun sessionUsable(registration: JSONObject, now: Instant = Instant.now()): Boolean {
            val session = registration.getJSONObject("session")
            val policy = session.getJSONObject("offlinePolicy")
            return SessionPolicy.usable(Instant.parse(session.getString("startedAt")), now,
                policy.getLong("maxAgeHours"), registration.getInt("nextSequence"), policy.getInt("maxEvents"))
        }
    }
}

