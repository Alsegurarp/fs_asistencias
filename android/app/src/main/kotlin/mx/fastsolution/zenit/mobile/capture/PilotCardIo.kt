package mx.fastsolution.zenit.mobile.capture

import android.nfc.tech.MifareClassic

class PilotCardException(message: String) : IllegalStateException(message)

/** Lee y escribe la credencial del piloto en una MIFARE Classic 1K. Nunca toca el sector 0. */
object PilotCardIo {
    /** Lee la credencial con la clave de la empresa; nulo si la tarjeta no está preparada. */
    fun read(card: MifareClassic, uid: ByteArray, sectorKey: ByteArray): PilotCredential? {
        requireClassic1k(card)
        val bytes = readCredentialArea(card, sectorKey) ?: return null
        return PilotCardFormat.decode(uid, bytes)
    }

    /**
     * Escribe la credencial, cambia la clave de sus sectores por la de la
     * empresa, deja en ceros los sectores 3 a 8 y relee para comprobar. Si
     * algo falla no se informa éxito: se vuelve a intentar con la tarjeta.
     */
    fun write(card: MifareClassic, sectorKey: ByteArray, credential: PilotCredential) {
        requireClassic1k(card)
        val data = PilotCardFormat.encode(credential)
        PilotCardFormat.CREDENTIAL_SECTORS.forEachIndexed { index, sector ->
            if (!open(card, sector, sectorKey)) throw PilotCardException("La tarjeta usa una clave desconocida. No se puede preparar con esta app.")
            (0..2).forEach { offset ->
                val start = (index * 3 + offset) * 16
                card.writeBlock(card.sectorToBlock(sector) + offset, data.copyOfRange(start, start + 16))
            }
            card.writeBlock(card.sectorToBlock(sector) + 3, PilotCardFormat.trailer(sectorKey))
        }
        // El formato anterior guardaba nombre y puesto aquí: se borra si se puede abrir.
        PilotCardFormat.WIPED_SECTORS.forEach { sector ->
            if (open(card, sector, sectorKey)) {
                (0..2).forEach { offset ->
                    val block = card.sectorToBlock(sector) + offset
                    if (card.readBlock(block).any { it.toInt() != 0 }) card.writeBlock(block, ByteArray(16))
                }
            }
        }
        val written = readCredentialArea(card, sectorKey)
        if (written == null || !written.contentEquals(data)) throw PilotCardException("La tarjeta no quedó bien escrita. Manténgala inmóvil y vuelva a intentarlo.")
    }

    private fun readCredentialArea(card: MifareClassic, sectorKey: ByteArray): ByteArray? {
        val out = java.io.ByteArrayOutputStream()
        PilotCardFormat.CREDENTIAL_SECTORS.forEach { sector ->
            if (!card.authenticateSectorWithKeyA(sector, sectorKey)) return null
            (0..2).forEach { out.write(card.readBlock(card.sectorToBlock(sector) + it)) }
        }
        return out.toByteArray()
    }

    /** Abre un sector con la clave de la empresa o, si aún no se preparó, con la de fábrica. */
    private fun open(card: MifareClassic, sector: Int, sectorKey: ByteArray): Boolean =
        card.authenticateSectorWithKeyA(sector, sectorKey) || card.authenticateSectorWithKeyA(sector, MifareClassic.KEY_DEFAULT)

    private fun requireClassic1k(card: MifareClassic) {
        if (card.type != MifareClassic.TYPE_CLASSIC || card.size != MifareClassic.SIZE_1K) {
            throw PilotCardException("Esta tarjeta no es una MIFARE Classic de 1 KB.")
        }
    }
}
