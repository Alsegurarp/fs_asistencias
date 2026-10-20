package mx.fastsolution.zenit.mobile

import java.nio.ByteBuffer
import java.util.zip.CRC32

/** Private Zenit format, sectors 1..8 data blocks only; never sector zero or trailers. */
object CardCredentialFormat {
    val blocks: List<Int> = (1..8).flatMap { sector -> (0..2).map { sector * 4 + it } }
    const val capacity = 384
    private val magic = "ZENITC01".toByteArray(Charsets.US_ASCII)
    val pendingHeader: ByteArray get() = "ZENITP01".toByteArray(Charsets.US_ASCII).copyOf(16)
    fun encode(text: String): ByteArray {
        val payload = text.toByteArray(Charsets.UTF_8)
        require(payload.size in 1..capacity - 16) { "Los datos superan la capacidad de la credencial." }
        val crc = CRC32().apply { update(payload) }.value.toInt()
        return ByteBuffer.allocate(capacity).put(magic).putInt(payload.size).putInt(crc).put(payload).array()
    }
    fun decode(bytes: ByteArray): String {
        require(bytes.size == capacity && bytes.copyOfRange(0, 8).contentEquals(magic)) { "La tarjeta no contiene una credencial Zenit completa." }
        val buffer = ByteBuffer.wrap(bytes).apply { position(8) }
        val length = buffer.int
        val crc = buffer.int
        require(length in 1..capacity - 16) { "Longitud de credencial inválida." }
        val payload = bytes.copyOfRange(16, 16 + length)
        require(CRC32().apply { update(payload) }.value.toInt() == crc) { "La escritura está incompleta o dañada. Repite la preparación." }
        return payload.toString(Charsets.UTF_8)
    }
    fun canReplace(bytes: ByteArray): Boolean = bytes.size == capacity &&
        (bytes.all { it == 0.toByte() } || bytes.copyOfRange(0, 8).contentEquals(magic) ||
            bytes.copyOfRange(0, 8).contentEquals(pendingHeader.copyOfRange(0, 8)))
}