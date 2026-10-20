package mx.fastsolution.zenit.mobile

import android.nfc.tech.MifareClassic
import org.json.JSONObject

internal object CardCredentialReader {
    fun read(card: MifareClassic, key: ByteArray): ByteArray {
        require(key.size == 6) { "Introduce una clave A válida de 12 caracteres hexadecimales." }
        require(card.type == MifareClassic.TYPE_CLASSIC && card.size == MifareClassic.SIZE_1K) {
            "Se requiere MIFARE Classic de 1 KB para consultar este formato."
        }
        return CardCredentialFormat.blocks.flatMap { block ->
            check(card.authenticateSectorWithKeyA(card.blockToSector(block), key)) {
                "No se pudo leer el contenido con esta clave A. Solicita la clave al proveedor."
            }
            card.readBlock(block).toList()
        }.toByteArray()
    }

    fun describe(bytes: ByteArray): String {
        if (bytes.all { it == 0.toByte() }) return "No hay datos de empleado guardados."
        if (bytes.copyOfRange(0, 8).contentEquals(CardCredentialFormat.pendingHeader.copyOfRange(0, 8))) {
            return "La carga anterior quedó incompleta. Prepara la tarjeta de nuevo."
        }
        val text = CardCredentialFormat.decode(bytes)
        return runCatching {
            val data = JSONObject(text)
            "Nombre: ${data.getString("fullName")}\nPuesto: ${data.getString("position")}\nHorario: ${data.getString("schedule")}\nID de empleado: ${data.getString("employeeId")}" +
                if (data.optBoolean("example")) "\nDatos de ejemplo" else ""
        }.getOrDefault("No se reconocen datos de empleado en esta tarjeta.")
    }
}