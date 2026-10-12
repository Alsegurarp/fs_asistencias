package mx.fastsolution.zenit.mobile.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.time.Instant
import java.util.Base64
import java.util.UUID
import org.json.JSONObject

class DeviceSigner(val alias: String) {
    private val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    fun publicJwk(): JSONObject {
        val key = store.getCertificate(alias).publicKey as ECPublicKey
        fun coordinate(bytes: ByteArray) = encode(ByteArray(32).also {
            val unsigned = if (bytes.size == 33 && bytes[0] == 0.toByte()) bytes.copyOfRange(1, 33) else bytes
            require(unsigned.size <= 32)
            unsigned.copyInto(it, 32 - unsigned.size)
        })
        return JSONObject().put("kty", "EC").put("crv", "P-256")
            .put("x", coordinate(key.w.affineX.toByteArray())).put("y", coordinate(key.w.affineY.toByteArray()))
    }

    fun sign(payload: JSONObject, deviceId: String? = null): String {
        val header = JSONObject().put("alg", "ES256")
        if (deviceId != null) header.put("kid", deviceId)
        val input = "${encode(header.toString().toByteArray(Charsets.UTF_8))}.${encode(payload.toString().toByteArray(Charsets.UTF_8))}"
        val signature = Signature.getInstance("SHA256withECDSA").apply {
            initSign(store.getKey(alias, null) as java.security.PrivateKey)
            update(input.toByteArray(Charsets.US_ASCII))
        }.sign()
        return "$input.${encode(Es256.joseSignature(signature))}"
    }

    fun assertion(registration: JSONObject): String {
        val id = registration.getString("deviceId")
        val seconds = minOf(60, registration.getJSONObject("session").getInt("tokenMaxAgeSeconds"))
        require(seconds > 0)
        val now = Instant.now().epochSecond
        return sign(JSONObject().put("iss", id).put("sub", id).put("aud", registration.getString("audience"))
            .put("iat", now).put("exp", now + seconds), id)
    }

    companion object {
        fun create(): DeviceSigner {
            val alias = "zenit_device_${UUID.randomUUID()}"
            KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore").apply {
                initialize(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                    .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                    .setDigests(KeyProperties.DIGEST_SHA256).build())
            }.generateKeyPair()
            return DeviceSigner(alias)
        }
        fun encode(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }
}
