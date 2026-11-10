package mx.fastsolution.zenit.mobile.testing

import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.MifareUltralight
import android.nfc.tech.NfcA
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

/**
 * Debug-only: identifies a physical card (technology, DESFire version, which
 * MIFARE Classic sectors open with the factory key). Read-only: it never writes,
 * changes keys or captures attendance. Output goes to the screen and to logcat
 * under the tag [TAG].
 */
class CardProbeActivity : ComponentActivity(), NfcAdapter.ReaderCallback {
    private val adapter by lazy { NfcAdapter.getDefaultAdapter(this) }
    private var report by mutableStateOf("Acerque una tarjeta a la parte posterior del teléfono.")
    private var count = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
                        Text("Identificar tarjeta (debug)", style = MaterialTheme.typography.titleLarge)
                        Text(report, fontFamily = FontFamily.Monospace, modifier = Modifier.padding(top = 12.dp))
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (adapter?.isEnabled != true) {
            report = "NFC apagado o no disponible."
            Log.w(TAG, report)
            return
        }
        adapter?.enableReaderMode(
            this, this,
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_NFC_F or
                NfcAdapter.FLAG_READER_NFC_V or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK or
                NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS,
            null,
        )
        Log.i(TAG, "READY")
    }

    override fun onPause() {
        adapter?.disableReaderMode(this)
        super.onPause()
    }

    override fun onTagDiscovered(tag: Tag) {
        count++
        val lines = mutableListOf("#$count")
        try {
            probe(tag, lines)
        } catch (failure: Exception) {
            lines += "ERROR ${failure.javaClass.simpleName}: ${failure.message}"
        }
        lines += "END"
        lines.forEach { Log.i(TAG, it) }
        runOnUiThread { report = lines.joinToString("\n") }
    }

    private fun probe(tag: Tag, out: MutableList<String>) {
        out += "uid=${tag.id.hex()} (${tag.id.size} bytes)"
        out += "techs=${tag.techList.joinToString { it.substringAfterLast('.') }}"
        NfcA.get(tag)?.let { out += "nfcA atqa=${it.atqa.hex()} sak=%02X maxTransceive=${it.maxTransceiveLength}".format(it.sak) }
        IsoDep.get(tag)?.let { probeIsoDep(it, out) }
        MifareClassic.get(tag)?.let { probeClassic(it, out) }
        MifareUltralight.get(tag)?.let {
            out += "ultralight type=${when (it.type) { MifareUltralight.TYPE_ULTRALIGHT -> "UL"; MifareUltralight.TYPE_ULTRALIGHT_C -> "UL-C"; else -> "?" }}"
        }
    }

    private fun probeIsoDep(card: IsoDep, out: MutableList<String>) {
        card.connect()
        try {
            card.timeout = 2000
            out += "isoDep hist=${card.historicalBytes?.hex()} hiLayer=${card.hiLayerResponse?.hex()} extApdu=${card.isExtendedLengthApduSupported}"
            val version = desfire(card, 0x60, out) ?: return
            if (version.size >= 28) {
                val hwType = version[1].toInt() and 0xFF
                val major = version[3].toInt() and 0xFF
                val storage = version[5].toInt() and 0xFF
                val family = if (hwType == 0x01) "DESFire" else "tipo %02X".format(hwType)
                val generation = when (major) { 0x00 -> "EV0"; 0x01 -> "EV1"; 0x12 -> "EV2"; 0x22 -> "EV2 XL"; 0x30, 0x33 -> "EV3"; else -> "major %02X".format(major) }
                val bytes = 1 shl (storage shr 1)
                out += "desfire=$family $generation hw=${version.copyOfRange(0, 7).hex()} sw=${version.copyOfRange(7, 14).hex()} storage≈${bytes}B" +
                    (if (storage and 1 == 1) "+" else "")
                out += "desfire uid=${version.copyOfRange(14, 21).hex()} batch=${version.copyOfRange(21, 26).hex()} prod=%02X/%02X".format(version[26], version[27])
            }
            desfire(card, 0x45, out)?.let { out += "piccKeySettings=${it.hex()} (settings, maxKeys/tipo)" }
            desfire(card, 0x6A, out)?.let { aids -> out += "aids=" + aids.toList().chunked(3).joinToString { it.toByteArray().hex() }.ifEmpty { "(ninguna)" } }
            desfire(card, 0x6E, out)?.let { out += "freeMem=${it.foldIndexed(0) { i, acc, b -> acc or ((b.toInt() and 0xFF) shl (8 * i)) }}B" }
        } finally {
            runCatching { card.close() }
        }
    }

    /** DESFire native command wrapped in ISO 7816 (CLA 90); follows 91 AF frames. Returns null on error status. */
    private fun desfire(card: IsoDep, ins: Int, out: MutableList<String>): ByteArray? {
        val data = java.io.ByteArrayOutputStream()
        var command = byteArrayOf(0x90.toByte(), ins.toByte(), 0, 0, 0)
        repeat(8) {
            val response = card.transceive(command)
            if (response.size < 2) { out += "cmd %02X: respuesta corta ${response.hex()}".format(ins); return null }
            data.write(response, 0, response.size - 2)
            val sw1 = response[response.size - 2].toInt() and 0xFF
            val sw2 = response[response.size - 1].toInt() and 0xFF
            when {
                sw1 == 0x91 && sw2 == 0xAF -> command = byteArrayOf(0x90.toByte(), 0xAF.toByte(), 0, 0, 0)
                sw1 == 0x91 && sw2 == 0x00 -> return data.toByteArray()
                else -> { out += "cmd %02X: sw=%02X%02X".format(ins, sw1, sw2); return null }
            }
        }
        return null
    }

    private fun probeClassic(card: MifareClassic, out: MutableList<String>) {
        card.connect()
        try {
            val type = when (card.type) { MifareClassic.TYPE_CLASSIC -> "Classic"; MifareClassic.TYPE_PLUS -> "Plus"; MifareClassic.TYPE_PRO -> "Pro"; else -> "?" }
            out += "classic type=$type size=${card.size} sectors=${card.sectorCount}"
            val keys = listOf("default" to MifareClassic.KEY_DEFAULT, "mad" to MifareClassic.KEY_MIFARE_APPLICATION_DIRECTORY, "ndef" to MifareClassic.KEY_NFC_FORUM)
            val result = (0 until card.sectorCount).map { sector ->
                val a = keys.firstOrNull { (_, key) -> runCatching { card.authenticateSectorWithKeyA(sector, key) }.getOrDefault(false) }?.first
                val b = if (a == null) keys.firstOrNull { (_, key) -> runCatching { card.authenticateSectorWithKeyB(sector, key) }.getOrDefault(false) }?.first else null
                when { a != null -> "$sector:A/$a"; b != null -> "$sector:B/$b"; else -> "$sector:-" }
            }
            out += "classic sectors " + result.joinToString(" ")
            if (runCatching { card.authenticateSectorWithKeyA(0, MifareClassic.KEY_DEFAULT) }.getOrDefault(false)) {
                out += "block0=${card.readBlock(0).hex()}"
            }
        } finally {
            runCatching { card.close() }
        }
    }

    private fun ByteArray.hex() = joinToString("") { "%02X".format(it) }

    companion object { const val TAG = "ZenitCardProbe" }
}
