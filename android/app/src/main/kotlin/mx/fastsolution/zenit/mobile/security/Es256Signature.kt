package mx.fastsolution.zenit.mobile.security

/** Converts the short DER sequence produced by a P-256 signer to JOSE R || S. */
object Es256Signature {
    fun fromDer(der: ByteArray): ByteArray {
        var offset = 0
        fun read(): Int {
            require(offset < der.size) { "Truncated signature" }
            return der[offset++].toInt() and 255
        }
        require(read() == 0x30)
        require(read() == der.size - 2)
        val result = ByteArray(64)
        repeat(2) { component ->
            require(read() == 0x02)
            val length = read()
            require(length in 1..33 && offset + length <= der.size)
            require(der[offset].toInt() and 0x80 == 0) { "Negative integer" }
            var start = offset
            var size = length
            if (size > 1 && der[start] == 0.toByte()) {
                require(der[start + 1].toInt() and 0x80 != 0) { "Non-canonical integer" }
                start++
                size--
            }
            require(size <= 32)
            der.copyInto(result, component * 32 + 32 - size, start, start + size)
            offset += length
        }
        require(offset == der.size)
        return result
    }
}
