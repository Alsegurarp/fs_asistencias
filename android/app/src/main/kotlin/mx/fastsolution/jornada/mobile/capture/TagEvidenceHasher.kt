package mx.fastsolution.jornada.mobile.capture

import java.security.MessageDigest

object TagEvidenceHasher {
    fun sha256(tagId: ByteArray): String {
        require(tagId.isNotEmpty()) { "El identificador NFC no puede estar vacio" }
        return MessageDigest.getInstance("SHA-256")
            .digest(tagId)
            .joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }
}

