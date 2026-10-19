package mx.fastsolution.zenit.mobile.testing

import android.content.Context
import android.content.ContextWrapper
import android.os.Bundle
import android.os.Build
import android.os.SystemClock
import java.io.IOException
import java.time.Instant
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import mx.fastsolution.zenit.mobile.data.AttendanceDatabase
import mx.fastsolution.zenit.mobile.data.AttendanceRepository
import mx.fastsolution.zenit.mobile.data.CaptureApi
import mx.fastsolution.zenit.mobile.data.CaptureApiException
import mx.fastsolution.zenit.mobile.security.DeviceSigner
import mx.fastsolution.zenit.mobile.security.OfflineEventCipher
import org.json.JSONArray
import org.json.JSONObject

/** Cada fase corre en un proceso nuevo y usa el almacén del autoensayo, separado del de la app. */
internal suspend fun backendSmoke(context: Context, arguments: Bundle, reportDevice: (JSONObject) -> Unit): String {
    val baseUrl = CaptureApi.validateBaseUrl(requireNotNull(arguments.getString("baseUrl")))
    if (arguments.getString("phase") == "proxy") {
        val signer = DeviceSigner.create()
        try {
            val code = "00000-00000"
            val body = JSONObject().put("enrollmentCode", code).put("publicKey", signer.publicJwk())
                .put("proof", signer.sign(JSONObject().put("enrollmentCode", code))).put("screenLock", true)
                .put("device", JSONObject().put("manufacturer", Build.MANUFACTURER).put("model", Build.MODEL)
                    .put("androidSdk", Build.VERSION.SDK_INT).put("appVersion", "0.1.0"))
            val failure = runCatching { CaptureApi(baseUrl).post("/device-activations", body) }.exceptionOrNull()
            check(failure is CaptureApiException && failure.status == 410 && failure.code == "enrollment_gone") {
                "La segunda conexión debe recibir 410; si recibe 429 puede compartir la IP o la cuota"
            }
        } finally {
            java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(signer.alias) }
        }
        return "BACKEND proxy: conexión del teléfono devuelve 410."
    }
    val mode = arguments.getString("mode")
    require(mode in setOf("personal", "terminal")) { "Indica mode=personal o terminal" }
    val phase = arguments.getString("phase")
    require(phase in setOf("activate", "queue", "sync")) { "Indica phase=activate, queue o sync" }
    val isolated = object : ContextWrapper(context.createDeviceProtectedStorageContext()) {
        override fun getApplicationContext(): Context = this
    }
    check(isolated.getDatabasePath("attendance-offline.db") != context.getDatabasePath("attendance-offline.db"))
    if (phase == "activate") {
        check(isolated.deleteDatabase("attendance-offline.db") || !isolated.getDatabasePath("attendance-offline.db").exists())
        check(isolated.getSharedPreferences("capture_device", 0).edit().clear().commit())
    }
    val repository = AttendanceRepository(isolated)
    val dao = AttendanceDatabase.get(isolated).pendingAttendanceDao()
    val cipher = OfflineEventCipher()
    if (phase == "activate") {
        val code = requireNotNull(arguments.getString("code")) { "Falta el código de un uso" }
        // El contrato acepta de 6 a 32 caracteres; el backend emite grupos de cinco.
        for (invalid in listOf("", "ABCDE", "A".repeat(33))) {
            check(runCatching { repository.activate(baseUrl, invalid) }.exceptionOrNull() is IllegalArgumentException)
        }
        repository.activate(baseUrl, code)
        val registration = checkNotNull(repository.store.registration())
        reportDevice(JSONObject().put("deviceId", registration.getString("deviceId")).put("mode", registration.getString("mode")))
        check(registration.getString("mode") == mode)
        val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        check(keys.getKey(registration.getString("keyAlias"), null).encoded == null)
        val reused = runCatching { repository.activate(baseUrl, code) }.exceptionOrNull()
        check(reused is CaptureApiException && reused.status == 410 && reused.code == "enrollment_gone") { "El código debe ser de un uso" }
        check(repository.store.registration()?.getString("deviceId") == registration.getString("deviceId"))
        check(dao.pendingCount() == 0)
    } else {
        val registration = checkNotNull(repository.store.registration()) { "Ejecuta primero la fase activate" }
        check(registration.getString("baseUrl") == baseUrl && registration.getString("mode") == mode)
        if (phase == "queue") {
            check(dao.pendingCount() == 0)
            val hex = requireNotNull(arguments.getString("tagHex"))
            require(Regex("(?:[0-9A-Fa-f]{2}){4,32}").matches(hex)) { "tagHex debe contener de 4 a 32 bytes" }
            val tag = hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
            // Interrumpe sólo el transporte del ensayo, sin cambiar las redes del teléfono.
            repository.store.saveRegistration(JSONObject(registration.toString()).put("baseUrl", "http://127.0.0.1:1"))
            try {
                repository.capture(tag, "clock_in", Instant.now(), SystemClock.elapsedRealtime())
                // El backend trata dos lecturas en 60 segundos como la misma marca.
                delay(61_000)
                repository.capture(tag, "clock_out", Instant.now(), SystemClock.elapsedRealtime())
                repository.capture(tag + byteArrayOf(0), null, Instant.now(), SystemClock.elapsedRealtime())
                val queued = dao.nextPending(100)
                check(queued.size == 3 && queued.all { !it.encryptedPayload.toString(Charsets.UTF_8).contains("envelopeVersion") })
                check(runCatching { repository.renewSession() }.exceptionOrNull() is IllegalStateException)
                check(runCatching { repository.synchronize() }.exceptionOrNull() is IOException) { "La conexión interrumpida debe fallar" }
                val retained = dao.nextPending(100)
                check(retained.map { it.id } == queued.map { it.id })
                check(retained.zip(queued).all { (after, before) -> after.encryptedPayload.contentEquals(before.encryptedPayload) })
                check(AttendanceRepository(isolated).pendingCount.first() == 3)
            } finally {
                // Conserva el consecutivo reservado por capture.
                val current = checkNotNull(repository.store.registration())
                repository.store.saveRegistration(current.put("baseUrl", baseUrl))
            }
        } else {
            val pending = dao.nextPending(100)
            check(pending.size == 3) { "La cola debe sobrevivir al cambio de proceso" }
            val envelopes = pending.map { cipher.decrypt(it.encryptedPayload, it.initializationVector).toString(Charsets.UTF_8) }
            repository.synchronize()
            check(dao.pendingCount() == 0)
            val receipts = dao.observeReceipts().first().associate { event ->
                event.id to JSONObject(cipher.decrypt(checkNotNull(event.encryptedReceipt), checkNotNull(event.receiptInitializationVector)).toString(Charsets.UTF_8))
            }
            check(receipts.keys == pending.map { it.id }.toSet())
            val ordered = pending.map { checkNotNull(receipts[it.id]) }
            check(ordered.take(2).all { it.getString("outcome") in setOf("accepted", "accepted_with_incident") }) { "La tarjeta asignada debe producir marcajes aceptados" }
            check(ordered.take(2).map { it.getString("type") } == listOf("clock_in", "clock_out"))
            check(ordered.last().getString("outcome") == "rejected" && ordered.last().getJSONObject("rejection").getString("code") == "card_unknown")
            val repeated = CaptureApi(baseUrl).post("/attendance-events/batch", JSONObject().put("envelopes", JSONArray(envelopes)),
                DeviceSigner(registration.getString("keyAlias")).assertion(registration)).getJSONArray("receipts")
            check(repeated.length() == ordered.size)
            for (index in ordered.indices) {
                val again = repeated.getJSONObject(index)
                val before = ordered[index]
                check(again.getString("idempotencyKey") == before.getString("idempotencyKey"))
                check(again.getString("outcome") == before.getString("outcome") && again.optString("eventId") == before.optString("eventId"))
            }
            repository.synchronize()
            check(dao.pendingCount() == 0)
            val previous = registration.getJSONObject("session").getString("sessionId")
            repository.renewSession()
            val renewed = checkNotNull(AttendanceRepository(isolated).store.registration())
            check(renewed.getJSONObject("session").getString("sessionId") != previous && renewed.getInt("nextSequence") == 1)
        }
    }
    return "BACKEND $mode $phase: comprobaciones aprobadas."
}
