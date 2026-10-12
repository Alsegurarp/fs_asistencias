package mx.fastsolution.zenit.mobile.security

/** Android firma en DER; ES256 exige dos enteros sin signo de 32 bytes. */
object Es256 {
    fun joseSignature(der: ByteArray): ByteArray {
        require(der.size in 8..72 && der[0] == 0x30.toByte() && der[1].toInt() == der.size - 2) { "Firma DER no válida" }
        var offset = 2
        fun integer(): ByteArray {
            require(offset + 2 <= der.size && der[offset++] == 0x02.toByte()) { "Entero DER no válido" }
            val length = der[offset++].toInt() and 0xff
            require(length in 1..33 && offset + length <= der.size) { "Tamaño DER no válido" }
            val bytes = der.copyOfRange(offset, offset + length)
            offset += length
            require(bytes[0].toInt() >= 0) { "Entero DER negativo" }
            val unsigned = if (bytes.size > 1 && bytes[0] == 0.toByte()) {
                require(bytes[1].toInt() < 0) { "Entero DER no canónico" }
                bytes.copyOfRange(1, bytes.size)
            } else bytes
            require(unsigned.size <= 32 && unsigned.any { it != 0.toByte() }) { "Entero ES256 fuera de rango" }
            return ByteArray(32).also { unsigned.copyInto(it, 32 - unsigned.size) }
        }
        val result = integer() + integer()
        require(offset == der.size) { "Firma DER con datos adicionales" }
        return result
    }
}
