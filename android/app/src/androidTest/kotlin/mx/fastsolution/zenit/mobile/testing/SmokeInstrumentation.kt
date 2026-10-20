package mx.fastsolution.zenit.mobile.testing

import android.app.Instrumentation
import android.content.Context
import android.content.ContextWrapper
import android.os.Bundle
import android.os.SystemClock
import java.math.BigInteger
import java.net.InetAddress
import java.net.ServerSocket
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPublicKeySpec
import java.security.spec.ECPoint
import java.time.Instant
import java.util.Base64
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import mx.fastsolution.zenit.mobile.data.AttendanceDatabase
import mx.fastsolution.zenit.mobile.data.AttendanceRepository
import mx.fastsolution.zenit.mobile.data.CaptureApiException
import mx.fastsolution.zenit.mobile.security.OfflineEventCipher
import org.json.JSONArray
import org.json.JSONObject

/** Autoensayo en el teléfono; HTTP de prueba y almacenamiento separado de los datos de la app. */
class SmokeInstrumentation : Instrumentation() {
    private var arguments = Bundle()
    override fun onCreate(arguments: Bundle?) {
        this.arguments = arguments ?: Bundle()
        super.onCreate(arguments)
        start()
    }

    override fun onStart() {
        val result = Bundle()
        try {
            val backend = listOf("baseUrl", "code", "mode", "phase", "tagHex").any(arguments::containsKey)
            val message = runBlocking {
                if (backend) backendSmoke(targetContext, arguments) { device ->
                    sendStatus(0, Bundle().apply { putString("stream", "DEVICE: $device\n") })
                } else {
                    smoke()
                    "FIXTURE: Keystore ES256, migración sin pérdida, activación, cola cifrada, reintento idéntico, recibos, captura concurrente y reenrolamiento sin borrado."
                }
            }
            result.putString("stream", "OK: $message\n")
            finish(-1, result)
        } catch (error: Throwable) {
            result.putString("stream", "FAIL: ${error.javaClass.simpleName}: ${error.message}\n${error.stackTrace.take(6).joinToString("\n")}\n")
            finish(0, result)
        }
    }

    private suspend fun smoke() {
        val isolated = object : ContextWrapper(targetContext.createDeviceProtectedStorageContext()) {
            override fun getApplicationContext(): Context = this
        }
        check(isolated.getDatabasePath("attendance-offline.db") != targetContext.getDatabasePath("attendance-offline.db"))
        // Sólo se reinicia el almacén de este autoensayo, que la app no utiliza.
        isolated.deleteDatabase("attendance-offline.db")
        check(isolated.getSharedPreferences("capture_device", 0).edit().clear().commit())
        val cipher = OfflineEventCipher()
        val legacy = cipher.encrypt("registro anterior sin firma".toByteArray())
        isolated.openOrCreateDatabase("attendance-offline.db", 0, null).use { db ->
            db.execSQL("CREATE TABLE pending_attendance_event (id TEXT NOT NULL PRIMARY KEY, encryptedPayload BLOB NOT NULL, initializationVector BLOB NOT NULL, capturedAtEpochMillis INTEGER NOT NULL, status TEXT NOT NULL)")
            db.execSQL("CREATE INDEX index_pending_attendance_event_status_capturedAtEpochMillis ON pending_attendance_event(status, capturedAtEpochMillis)")
            db.execSQL("INSERT INTO pending_attendance_event VALUES (?, ?, ?, ?, ?)", arrayOf("legacy-smoke", legacy.ciphertext, legacy.initializationVector, 1L, "pending"))
            db.version = 1
        }
        val repository = AttendanceRepository(isolated)
        check(repository.legacyCount.first() == 1)
        check(repository.pendingCount.first() == 0)
        FixtureServer().use { server ->
            repository.activate("http://127.0.0.1:${server.port}", "ABCD-EFGH")
            val registered = checkNotNull(repository.store.registration())
            check(registered.getString("deviceId") == server.deviceId)
            val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            check(keys.getKey(registered.getString("keyAlias"), null).encoded == null) { "La clave privada no debe ser exportable" }
            check(AttendanceRepository(isolated).store.registration()?.getString("keyAlias") == registered.getString("keyAlias"))
            val week = repository.personalWeek("2026-10-05")
            check(week.getJSONObject("closure").getString("id") == server.closureId)
            val report = mx.fastsolution.zenit.mobile.personalWeekReport(week, null)
            check(report.contains("2026-10-05 07:00:00 -06:00") && report.contains("Sin salida registrada"))
            val ack = repository.acknowledgeWeek(server.closureId, "objected", "Falta mi salida")
            check(ack.getString("type") == "objected")
            val refreshed = AttendanceRepository(isolated).personalWeek("2026-10-05")
            check(refreshed.getJSONObject("_localAcknowledgement").getString("id") == ack.getString("id"))
            check(!refreshed.toString().contains("keyAlias"))
            check(runCatching { repository.acknowledgeWeek(server.closureId, "agreed", "") }.exceptionOrNull().let { it is CaptureApiException && it.status == 409 })
            val terminal = JSONObject(registered.toString()).put("mode", "terminal")
            repository.store.saveRegistration(terminal)
            check(runCatching { repository.personalWeek("2026-10-05") }.exceptionOrNull() is IllegalStateException)
            check(runCatching { repository.acknowledgeWeek(server.closureId, "agreed", "") }.exceptionOrNull() is IllegalStateException)
            repository.store.saveRegistration(registered)
            repository.capture(byteArrayOf(1, 2, 3, 4), null, Instant.now(), SystemClock.elapsedRealtime())
            repository.capture(byteArrayOf(5, 6, 7, 8), "clock_out", Instant.now(), SystemClock.elapsedRealtime())
            val dao = AttendanceDatabase.get(isolated).pendingAttendanceDao()
            check(dao.pendingCount() == 2)
            val queued = dao.nextPending(100)
            check(queued.all { !it.encryptedPayload.toString(Charsets.UTF_8).contains("envelopeVersion") })
            check(runCatching { repository.renewSession() }.exceptionOrNull() is IllegalStateException) { "No debe renovar con pendientes" }
            server.failNext = true
            val unavailable = runCatching { repository.synchronize() }.exceptionOrNull()
            check(unavailable is CaptureApiException && unavailable.status == 503) { "Debe conservar el lote ante HTTP 503" }
            check(dao.pendingCount() == 2)
            server.mismatchNext = true
            check(runCatching { repository.synchronize() }.exceptionOrNull() is IllegalStateException) { "Debe rechazar un recibo ajeno" }
            check(dao.pendingCount() == 2)
            repository.synchronize()
            check(dao.pendingCount() == 0)
            check(server.batchRequests == 3)
            val receipts = dao.observeReceipts().first()
            check(receipts.size == 2 && receipts.any { it.status == "rejected" } && receipts.any { it.status == "accepted" })
            check(receipts.map(repository::readReceipt).any { it.contains("Entrada") })
            check(receipts.map(repository::readReceipt).any { it.contains("card_unknown") })
            repository.synchronize()
            check(server.batchRequests == 3)
            repository.renewSession()
            check(repository.store.registration()?.getInt("nextSequence") == 1)
            check(repository.legacyCount.first() == 1)
            val preserved = AttendanceDatabase.get(isolated).openHelper.readableDatabase.query("SELECT encryptedPayload, initializationVector FROM pending_attendance_event WHERE id = 'legacy-smoke'")
            preserved.use { check(it.moveToFirst()); check(cipher.decrypt(it.getBlob(0), it.getBlob(1)).toString(Charsets.UTF_8) == "registro anterior sin firma") }
            repository.capture(byteArrayOf(1, 2, 3, 4), null, Instant.now(), SystemClock.elapsedRealtime())
            coroutineScope {
                server.failNext = true
                server.delayNext = true
                val syncing = async { runCatching { repository.synchronize() }.exceptionOrNull() }
                withContext(Dispatchers.IO) { check(server.delayStarted.await(5, TimeUnit.SECONDS)) }
                withTimeout(1500) { repository.capture(byteArrayOf(9, 10, 11, 12), null, Instant.now(), SystemClock.elapsedRealtime()) }
                check(syncing.await() is CaptureApiException)
            }
            check(dao.pendingCount() == 2)
            check(runCatching { repository.activate("http://127.0.0.1:${server.port}", "ABCD-EFGH") }.exceptionOrNull() is IllegalStateException)
            repository.activate("http://127.0.0.1:${server.port}", "ABCD-EFGH", preservePreviousPending = true)
            check(dao.pendingCount() == 0 && repository.legacyCount.first() == 3)
            server.failure?.let { throw it }
        }
    }
}

private class FixtureServer : AutoCloseable {
    private val server = ServerSocket(0, 10, InetAddress.getByName("127.0.0.1"))
    val port: Int get() = server.localPort
    val deviceId = UUID.randomUUID().toString()
    val closureId = UUID.randomUUID().toString()
    private var acknowledged = false
    private var sessionId = UUID.randomUUID().toString()
    private lateinit var publicKey: java.security.PublicKey
    @Volatile var failNext = false
    @Volatile var mismatchNext = false
    @Volatile var delayNext = false
    val delayStarted = CountDownLatch(1)
    @Volatile var batchRequests = 0
    @Volatile var failure: Throwable? = null
    private val originalEnvelopes = mutableMapOf<String, String>()
    private val thread = Thread {
        while (!server.isClosed) {
            try {
                server.accept().use { socket ->
                    socket.soTimeout = 10_000
                    val reader = socket.getInputStream().bufferedReader(Charsets.UTF_8)
                    val request = reader.readLine().split(' ')
                    val headers = mutableMapOf<String, String>()
                    while (true) {
                        val line = reader.readLine()
                        if (line.isEmpty()) break
                        headers[line.substringBefore(':').lowercase()] = line.substringAfter(':').trim()
                    }
                    val chars = CharArray(headers["content-length"]?.toInt() ?: 0)
                    var count = 0
                    while (count < chars.size) { val read = reader.read(chars, count, chars.size - count); check(read > 0); count += read }
                    val body = if (chars.isEmpty()) JSONObject() else JSONObject(String(chars))
                    var status = 200
                    val reply = when (request[1]) {
                        "/api/v1/me/attendance?week=2026-10-05" -> {
                            check(request[0] == "GET")
                            verifyAssertion(headers.getValue("authorization"))
                            JSONObject().put("weekStart", "2026-10-05").put("timeZone", "America/Mexico_City")
                                .put("closure", JSONObject().put("id", closureId).put("version", 2).put("status", "closed"))
                                .put("totals", JSONObject().put("workedMinutes", 0).put("breakMinutes", 0).put("ordinaryMinutes", 0).put("overtimeMinutes", 0))
                                .put("segments", JSONArray().put(JSONObject().put("kind", "work").put("startAt", "2026-10-05T13:00:00Z").put("endAt", JSONObject.NULL).put("minutes", 0)))
                                .put("alerts", JSONArray()).put("openIncidentIds", JSONArray())
                        }
                        "/api/v1/week-closures/$closureId/acknowledgements" -> {
                            verifyAssertion(headers.getValue("authorization"))
                            if (acknowledged) { status = 409; JSONObject().put("code", "already_acknowledged") }
                            else {
                                acknowledged = true
                                JSONObject().put("id", UUID.randomUUID().toString()).put("closureId", closureId).put("type", body.getString("type"))
                                    .put("note", body.optString("note")).put("at", Instant.now().toString()).put("evidenceHash", "fixture-hash")
                            }
                        }
                        "/api/v1/device-activations" -> {
                            val jwk = body.getJSONObject("publicKey")
                            check(!jwk.has("d") && jwk.getString("crv") == "P-256")
                            val params = AlgorithmParameters.getInstance("EC").apply { init(ECGenParameterSpec("secp256r1")) }.getParameterSpec(ECParameterSpec::class.java)
                            val point = ECPoint(BigInteger(1, decode(jwk.getString("x"))), BigInteger(1, decode(jwk.getString("y"))))
                            publicKey = KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(point, params))
                            check(verify(body.getString("proof")).getString("enrollmentCode") == body.getString("enrollmentCode"))
                            check(body.getBoolean("screenLock"))
                            status = 201
                            JSONObject().put("deviceId", deviceId).put("mode", "personal").put("audience", "zenit-capture")
                                .put("tenant", JSONObject().put("name", "Empresa prueba").put("timeZone", "America/Mexico_City"))
                                .put("employee", JSONObject().put("id", UUID.randomUUID().toString()).put("displayName", "Persona prueba"))
                                .put("site", JSONObject.NULL).put("session", session())
                        }
                        "/api/v1/device-sessions" -> {
                            verifyAssertion(headers.getValue("authorization"))
                            sessionId = UUID.randomUUID().toString()
                            session()
                        }
                        "/api/v1/attendance-events/batch" -> {
                            verifyAssertion(headers.getValue("authorization"))
                            batchRequests++
                            val envelopes = body.getJSONArray("envelopes")
                            val actual = (0 until envelopes.length()).map(envelopes::getString)
                            val payloads = actual.map(::verify)
                            payloads.forEachIndexed { index, payload ->
                                val id = payload.getString("idempotencyKey")
                                val previous = originalEnvelopes.putIfAbsent(id, actual[index])
                                check(previous == null || previous == actual[index]) { "El reintento cambió la evidencia" }
                            }
                            if (batchRequests == 1) check(payloads.map { it.getInt("sequence") } == listOf(1, 2))
                            check(payloads.all { it.getString("sessionId") == sessionId && it.has("location") && it.getJSONObject("card").getString("scheme") == "uid_sha256" })
                            if (delayNext) { delayNext = false; delayStarted.countDown(); Thread.sleep(2000) }
                            if (failNext) {
                                failNext = false; status = 503
                                JSONObject().put("title", "No disponible")
                            } else {
                                val receipts = JSONArray()
                                payloads.forEachIndexed { index, payload ->
                                    receipts.put(JSONObject().put("idempotencyKey", if (mismatchNext) UUID.randomUUID().toString() else payload.getString("idempotencyKey"))
                                        .put("outcome", if (index == 0) "accepted" else "rejected").put("type", if (index == 0) "clock_in" else JSONObject.NULL)
                                        .put("observedAt", payload.getString("observedAt")).put("receivedAt", Instant.now().toString())
                                        .put("employee", if (index == 0) JSONObject().put("displayName", "Persona prueba") else JSONObject.NULL)
                                        .put("rejection", if (index == 0) JSONObject.NULL else JSONObject().put("code", "card_unknown").put("message", "Tarjeta no registrada")))
                                }
                                mismatchNext = false
                                JSONObject().put("receipts", receipts)
                            }
                        }
                        else -> error("Ruta inesperada")
                    }
                    val bytes = reply.toString().toByteArray(Charsets.UTF_8)
                    socket.getOutputStream().apply {
                        write("HTTP/1.1 $status Test\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        write(bytes); flush()
                    }
                }
            } catch (error: Throwable) { if (!server.isClosed) { failure = error; server.close() } }
        }
    }.apply { isDaemon = true; start() }

    private fun session() = JSONObject().put("sessionId", sessionId).put("startedAt", Instant.now().toString()).put("serverTime", Instant.now().toString())
        .put("breakPolicy", "not_considered").put("tokenMaxAgeSeconds", 120).put("locationReuseSeconds", 0)
        .put("offlinePolicy", JSONObject().put("maxAgeHours", 72).put("maxEvents", 1000))

    private fun verifyAssertion(header: String) {
        val claims = verify(header.removePrefix("Bearer "))
        check(claims.getString("iss") == deviceId && claims.getString("sub") == deviceId && claims.getString("aud") == "zenit-capture")
        check(claims.getLong("exp") - claims.getLong("iat") in 1..120)
    }

    private fun verify(jws: String): JSONObject {
        val parts = jws.split('.')
        check(parts.size == 3 && JSONObject(String(decode(parts[0]), Charsets.UTF_8)).getString("alg") == "ES256")
        val raw = decode(parts[2])
        check(raw.size == 64)
        fun integer(bytes: ByteArray): ByteArray {
            val value = BigInteger(1, bytes).toByteArray()
            return byteArrayOf(2, value.size.toByte()) + value
        }
        val integers = integer(raw.copyOfRange(0, 32)) + integer(raw.copyOfRange(32, 64))
        val der = byteArrayOf(0x30, integers.size.toByte()) + integers
        val valid = Signature.getInstance("SHA256withECDSA").apply { initVerify(publicKey); update("${parts[0]}.${parts[1]}".toByteArray(Charsets.US_ASCII)) }.verify(der)
        check(valid) { "Firma de Android Keystore no válida" }
        return JSONObject(String(decode(parts[1]), Charsets.UTF_8))
    }
    private fun decode(value: String) = Base64.getUrlDecoder().decode(value)
    override fun close() { server.close(); thread.join(1000) }
}
