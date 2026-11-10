package mx.fastsolution.zenit.card

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import mx.fastsolution.zenit.api.Checks
import mx.fastsolution.zenit.api.Problems
import mx.fastsolution.zenit.audit.AuditLog
import mx.fastsolution.zenit.capture.CaptureProperties
import mx.fastsolution.zenit.device.CurrentDevice
import mx.fastsolution.zenit.tenant.TenantRepository
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.util.Base64
import java.util.HexFormat
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Tarjeta del piloto (MIFARE Classic 1K): guarda sólo un código aleatorio y la
 * firma del servidor sobre ese código y el identificador de la tarjeta. No
 * lleva datos de la persona. La firma impide fabricar una tarjeta nueva, pero
 * la Classic se puede clonar con equipo especial: es un riesgo aceptado del
 * piloto hasta usar DESFire.
 */
object PilotCardFormat {
    const val SCHEME = "mifare_classic_signed"
    const val TOKEN_BYTES = 16
    const val SIGNATURE_BYTES = 64
    private val DOMAIN = "zenit-classic-v1".toByteArray(Charsets.US_ASCII)
    private val HEX: HexFormat = HexFormat.of()
    private val UID = Regex("^([0-9a-f]{8}|[0-9a-f]{14}|[0-9a-f]{20})$")
    private val TOKEN = Regex("^[0-9a-f]{${TOKEN_BYTES * 2}}$")

    /** Lo que se firma: dominio, identificador de la tarjeta, versión de la clave y código. */
    fun signedBytes(uid: ByteArray, keyVersion: Int, token: ByteArray): ByteArray =
        DOMAIN + byteArrayOf(uid.size.toByte()) + uid + byteArrayOf(keyVersion.toByte()) + token

    /** La huella que se guarda: el código ligado a su tarjeta. Ni el código ni el identificador se guardan solos. */
    fun fingerprint(uid: ByteArray, token: ByteArray): String =
        HEX.formatHex(MessageDigest.getInstance("SHA-256").digest(DOMAIN + uid + token))

    fun uid(value: String?): ByteArray? = value?.lowercase()?.takeIf { UID.matches(it) }?.let(HEX::parseHex)

    fun token(value: String?): ByteArray? = value?.lowercase()?.takeIf { TOKEN.matches(it) }?.let(HEX::parseHex)

    fun signature(value: String?): ByteArray? =
        value?.let { runCatching { Base64.getUrlDecoder().decode(it) }.getOrNull() }?.takeIf { it.size == SIGNATURE_BYTES }

    /** La prueba del sobre: `<uid>.<código>.<firma>`, los dos primeros en hexadecimal y la firma en base64url. */
    fun proof(value: String): Triple<ByteArray, ByteArray, ByteArray>? {
        val parts = value.split('.')
        if (parts.size != 3) return null
        val uid = uid(parts[0]) ?: return null
        val token = token(parts[1]) ?: return null
        val signature = signature(parts[2]) ?: return null
        return Triple(uid, token, signature)
    }

    fun hex(bytes: ByteArray): String = HEX.formatHex(bytes)
}

/**
 * La clave del piloto: una sola clave P-256 por ambiente, dada como JWK privada
 * en `zenit.capture.pilot-card-key`. Firma las tarjetas y de ella sale la clave
 * de los sectores de cada empresa.
 */
@Component
class PilotCardKeys(private val capture: CaptureProperties) {
    private val key: ECKey? = capture.pilotCardKey?.takeIf { it.isNotBlank() }?.let {
        val parsed = ECKey.parse(it.trim())
        require(parsed.curve == Curve.P_256 && parsed.isPrivate) { "zenit.capture.pilot-card-key debe ser una JWK P-256 privada" }
        parsed
    }

    /** El piloto se acepta sólo si se encendió y hay clave. */
    val enabled: Boolean get() = capture.pilotCards && key != null

    val keyVersion: Int get() = capture.pilotCardKeyVersion

    /** La clave pública en X.509, para que el teléfono compruebe la firma sin red. */
    fun verificationKey(): String = Base64.getEncoder().encodeToString(requireKey().toECPublicKey().encoded)

    /** Clave A y B de los sectores de las tarjetas de una empresa. Detiene las apps de celular, no un ataque a la Classic. */
    fun sectorKey(tenantId: UUID): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(requireKey().d.decode(), "HmacSHA256"))
        return mac.doFinal("zenit-classic-sector-v1|$tenantId".toByteArray(Charsets.US_ASCII)).copyOf(6)
    }

    fun sign(message: ByteArray): ByteArray {
        val signer = Signature.getInstance("SHA256withECDSAinP1363Format")
        signer.initSign(requireKey().toECPrivateKey())
        signer.update(message)
        return signer.sign()
    }

    fun verify(message: ByteArray, signature: ByteArray): Boolean = runCatching {
        val verifier = Signature.getInstance("SHA256withECDSAinP1363Format")
        verifier.initVerify(requireKey().toECPublicKey())
        verifier.update(message)
        verifier.verify(signature)
    }.getOrDefault(false)

    private fun requireKey(): ECKey = key ?: throw IllegalStateException("Sin clave del piloto de tarjetas")
}

data class PilotCardIssueRequest(val uid: String?)

data class PilotCardCredentialView(val uid: String, val keyVersion: Int, val token: String, val signature: String)

data class PilotCardRegisterRequest(val uid: String?, val keyVersion: Int?, val token: String?, val signature: String?)

/** Lo que la captura necesita saber de una tarjeta del piloto. */
data class PilotCardProof(val fingerprint: String)

@Service
class PilotCardService(
    private val keys: PilotCardKeys,
    private val cards: CardRepository,
    private val tenants: TenantRepository,
    private val audit: AuditLog,
) {
    private val random = SecureRandom()

    /** Si el ambiente acepta tarjetas del piloto. */
    val enabled: Boolean get() = keys.enabled

    /** Firma un código nuevo para la tarjeta que la terminal tiene enfrente. No guarda nada hasta que se registra. */
    fun issue(device: CurrentDevice, request: PilotCardIssueRequest): PilotCardCredentialView {
        requireTerminal(device)
        val checks = Checks()
        val uid = PilotCardFormat.uid(request.uid)
        if (uid == null) checks.fail("uid", "invalid_uid", "Identificador de 4, 7 o 10 bytes en hexadecimal.")
        checks.done()
        val token = ByteArray(PilotCardFormat.TOKEN_BYTES).also(random::nextBytes)
        val signature = keys.sign(PilotCardFormat.signedBytes(uid!!, keys.keyVersion, token))
        return PilotCardCredentialView(PilotCardFormat.hex(uid), keys.keyVersion, PilotCardFormat.hex(token), Base64.getUrlEncoder().withoutPadding().encodeToString(signature))
    }

    /**
     * Da de alta en inventario una tarjeta ya escrita y comprobada. Se puede
     * repetir: la misma tarjeta devuelve la que ya existe.
     */
    @Transactional
    fun register(device: CurrentDevice, request: PilotCardRegisterRequest): Pair<CardRow, Boolean> {
        requireTerminal(device)
        val checks = Checks()
        val uid = PilotCardFormat.uid(request.uid)
        val token = PilotCardFormat.token(request.token)
        val signature = PilotCardFormat.signature(request.signature)
        if (uid == null) checks.fail("uid", "invalid_uid", "Identificador de 4, 7 o 10 bytes en hexadecimal.")
        if (token == null) checks.fail("token", "invalid_token", "Código de 16 bytes en hexadecimal.")
        if (signature == null) checks.fail("signature", "invalid_signature", "Firma de 64 bytes en base64url.")
        if (request.keyVersion != keys.keyVersion) checks.fail("keyVersion", "unknown_key", "La versión de la clave no es la vigente.")
        checks.done()
        if (!keys.verify(PilotCardFormat.signedBytes(uid!!, keys.keyVersion, token!!), signature!!)) {
            throw Problems.validation("signature", "invalid_signature", "La firma no corresponde a esta tarjeta.")
        }
        val fingerprint = PilotCardFormat.fingerprint(uid, token)
        cards.findByFingerprint(device.tenantId, fingerprint)?.let { return cards.find(device.tenantId, it.id)!! to false }
        val id = UUID.randomUUID()
        cards.insert(device.tenantId, id, label(fingerprint), fingerprint, keys.keyVersion)
        audit.record(device.tenantId, "device", device.id.toString(), "card.registered", "card", id, mapOf("scheme" to PilotCardFormat.SCHEME))
        return cards.find(device.tenantId, id)!! to true
    }

    /** Comprueba la prueba de un sobre y devuelve la huella con la que se busca la tarjeta; null si no vale. */
    fun verify(proof: String, keyVersion: Long?): PilotCardProof? {
        if (!keys.enabled || keyVersion?.toInt() != keys.keyVersion) return null
        val (uid, token, signature) = PilotCardFormat.proof(proof) ?: return null
        if (!keys.verify(PilotCardFormat.signedBytes(uid, keys.keyVersion, token), signature)) return null
        return PilotCardProof(PilotCardFormat.fingerprint(uid, token))
    }

    private fun requireTerminal(device: CurrentDevice) {
        if (!keys.enabled) throw Problems.conflict("pilot_cards_disabled", "Este ambiente no acepta tarjetas del piloto.")
        if (device.mode != "terminal") throw Problems.forbidden()
        val tenant = tenants.find(device.tenantId) ?: throw Problems.forbidden()
        if (tenant.status != "active") throw Problems.forbidden()
    }

    /** Etiqueta corta para escribirla en la tarjeta y encontrarla en el portal. */
    private fun label(fingerprint: String) = "ZC-" + fingerprint.take(8).uppercase()
}

@RestController
@RequestMapping("/api/v1/device-cards")
class PilotCardController(private val service: PilotCardService) {
    @PostMapping("/credentials")
    fun issue(@AuthenticationPrincipal device: CurrentDevice, @RequestBody request: PilotCardIssueRequest): PilotCardCredentialView =
        service.issue(device, request)

    /** 201 la primera vez; 200 cuando la tarjeta ya estaba registrada. */
    @PostMapping
    fun register(@AuthenticationPrincipal device: CurrentDevice, @RequestBody request: PilotCardRegisterRequest): ResponseEntity<CardView> {
        val (row, created) = service.register(device, request)
        return ResponseEntity.status(if (created) HttpStatus.CREATED else HttpStatus.OK).body(CardView.of(row))
    }
}

