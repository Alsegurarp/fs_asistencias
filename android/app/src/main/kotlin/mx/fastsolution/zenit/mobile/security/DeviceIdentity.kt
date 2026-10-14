package mx.fastsolution.zenit.mobile.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import org.json.JSONObject

class DeviceIdentity {
    private fun store(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    @Synchronized
    fun publicJwk(): JSONObject {
        if (!store().containsAlias(ALIAS)) {
            KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore").apply {
                initialize(
                    KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                        .setDigests(KeyProperties.DIGEST_SHA256)
                        .build(),
                )
            }.generateKeyPair()
        }
        val key = store().getCertificate(ALIAS).publicKey as ECPublicKey
        fun coordinate(bytes: ByteArray): String {
            val unsigned = if (bytes.size == 33 && bytes[0] == 0.toByte()) bytes.copyOfRange(1, 33) else bytes
            require(unsigned.size <= 32)
            return encode(ByteArray(32 - unsigned.size) + unsigned)
        }
        return JSONObject().put("kty", "EC").put("crv", "P-256")
            .put("x", coordinate(key.w.affineX.toByteArray()))
            .put("y", coordinate(key.w.affineY.toByteArray()))
    }

    fun activationProof(code: String): String {
        val input = encode("{\"alg\":\"ES256\"}".toByteArray(Charsets.UTF_8)) + "." +
            encode(JSONObject().put("enrollmentCode", code).toString().toByteArray(Charsets.UTF_8))
        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(store().getKey(ALIAS, null) as java.security.PrivateKey)
        signer.update(input.toByteArray(Charsets.US_ASCII))
        return "$input.${encode(Es256Signature.fromDer(signer.sign()))}"
    }

    private fun encode(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

    private companion object { const val ALIAS = "zenit_device_identity_v1" }
}
