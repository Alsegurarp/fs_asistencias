package mx.fastsolution.zenit.mobile.capture

import java.math.BigInteger
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/** Lo que la app pone en el sobre como tarjeta. */
data class CardEvidence(val scheme: String, val proof: String, val keyVersion: Int?) {
    companion object {
        /** Tarjeta simulada del prototipo: sólo en debug y con datos ficticios. */
        fun simulated(tagId: ByteArray) = CardEvidence("uid_sha256", TagEvidenceHasher.sha256(tagId), null)
    }
}

/** Lo que el servidor manda en la sesión para leer las tarjetas del piloto. */
data class PilotCardConfig(val keyVersion: Int, val sectorKey: ByteArray, val verificationKey: String)

/** Código firmado de una tarjeta del piloto. No lleva datos de la persona. */
class PilotCredential(val uid: ByteArray, val keyVersion: Int, val token: ByteArray, val signature: ByteArray) {
    fun evidence() = CardEvidence(PilotCardFormat.SCHEME, "${PilotCardFormat.hex(uid)}.${PilotCardFormat.hex(token)}.${PilotCardFormat.base64Url(signature)}", keyVersion)
}

/**
 * Formato de la tarjeta MIFARE Classic del piloto, en los bloques de datos de
 * los sectores 1 y 2: `ZNC1`, versión de la clave, código de 16 bytes y firma
 * de 64 bytes, con relleno de ceros. Esos dos sectores cambian su clave por
 * la de la empresa. Los sectores 3 a 8, donde el formato anterior guardaba
 * nombre y puesto, se dejan en ceros.
 */
object PilotCardFormat {
    const val SCHEME = "mifare_classic_signed"
    const val TOKEN_BYTES = 16
    const val SIGNATURE_BYTES = 64
    val CREDENTIAL_SECTORS = listOf(1, 2)
    val WIPED_SECTORS = (3..8).toList()
    val DATA_BLOCKS: List<Int> = CREDENTIAL_SECTORS.flatMap { sector -> (0..2).map { sector * 4 + it } }
    const val SIZE = 96
    private val MAGIC = "ZNC1".toByteArray(Charsets.US_ASCII)
    private val DOMAIN = "zenit-classic-v1".toByteArray(Charsets.US_ASCII)
    /** Permisos de fábrica (FF 07 80, 69): la clave A lee y escribe datos y claves. */
    private val ACCESS = byteArrayOf(0xFF.toByte(), 0x07, 0x80.toByte(), 0x69)

    fun encode(credential: PilotCredential): ByteArray {
        require(credential.token.size == TOKEN_BYTES && credential.signature.size == SIGNATURE_BYTES)
        require(credential.keyVersion in 0..255)
        return (MAGIC + byteArrayOf(credential.keyVersion.toByte()) + credential.token + credential.signature).copyOf(SIZE)
    }

    /** Nulo si el área no tiene una credencial del piloto (vacía o con otro formato). */
    fun decode(uid: ByteArray, bytes: ByteArray): PilotCredential? {
        if (bytes.size != SIZE || !bytes.copyOfRange(0, 4).contentEquals(MAGIC)) return null
        val keyVersion = bytes[4].toInt() and 0xFF
        val token = bytes.copyOfRange(5, 5 + TOKEN_BYTES)
        val signature = bytes.copyOfRange(5 + TOKEN_BYTES, 5 + TOKEN_BYTES + SIGNATURE_BYTES)
        return PilotCredential(uid, keyVersion, token, signature)
    }

    fun signedBytes(uid: ByteArray, keyVersion: Int, token: ByteArray): ByteArray =
        DOMAIN + byteArrayOf(uid.size.toByte()) + uid + byteArrayOf(keyVersion.toByte()) + token

    /** Comprueba la firma del servidor sin red, con la clave pública de la sesión. */
    fun verify(credential: PilotCredential, verificationKey: String): Boolean = runCatching {
        val key = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(verificationKey)))
        val verifier = Signature.getInstance("SHA256withECDSA")
        verifier.initVerify(key)
        verifier.update(signedBytes(credential.uid, credential.keyVersion, credential.token))
        verifier.verify(der(credential.signature))
    }.getOrDefault(false)

    /** Bloque final de un sector: clave A, permisos de fábrica y clave B. */
    fun trailer(key: ByteArray): ByteArray {
        require(key.size == 6)
        return key + ACCESS + key
    }

    /** La firma llega como `r || s`; Android la verifica en DER. */
    fun der(signature: ByteArray): ByteArray {
        require(signature.size == SIGNATURE_BYTES)
        fun integer(bytes: ByteArray): ByteArray {
            val value = BigInteger(1, bytes).toByteArray()
            return byteArrayOf(0x02, value.size.toByte()) + value
        }
        val body = integer(signature.copyOfRange(0, 32)) + integer(signature.copyOfRange(32, 64))
        return byteArrayOf(0x30, body.size.toByte()) + body
    }

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }

    fun parseHex(value: String): ByteArray {
        require(value.length % 2 == 0 && value.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' })
        return ByteArray(value.length / 2) { value.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }

    fun base64Url(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

    fun fromBase64Url(value: String): ByteArray = Base64.getUrlDecoder().decode(value)
}
