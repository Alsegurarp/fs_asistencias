package mx.fastsolution.zenit.mobile

import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.MifareClassic
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.util.concurrent.atomic.AtomicBoolean

/** Reads the physical credential; never writes blocks or captures attendance. */
class NfcDiagnosticActivity : ComponentActivity(), NfcAdapter.ReaderCallback {
    private val adapter by lazy { NfcAdapter.getDefaultAdapter(this) }
    private val handler = Handler(Looper.getMainLooper())
    private val busy = AtomicBoolean(false)
    @Volatile private var readKey = MifareClassic.KEY_DEFAULT.copyOf()
    @Volatile private var activeCard: MifareClassic? = null
    private var status by mutableStateOf("Aproxime la tarjeta a la parte posterior del dispositivo.")
    private var content by mutableStateOf("")
    private var loading by mutableStateOf(false)
    private var waiting by mutableStateOf(false)
    private val noCard = Runnable {
        waiting = false
        status = "No se detectó una tarjeta. Aproxímela al lector y seleccione Leer tarjeta para intentar nuevamente."
    }
    private fun waitForCard() {
        handler.removeCallbacks(noCard)
        if (adapter?.isEnabled != true) {
            waiting = false
            status = "El lector NFC no está disponible. Actívelo en la configuración del dispositivo."
            return
        }
        content = ""; waiting = true
        status = "Lectura de tarjeta en espera. Aproxime la tarjeta a la parte posterior del dispositivo."
        handler.postDelayed(noCard, 20000)
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = ZenitColors) {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        TextButton(onClick = { finish() }) { Text("Volver") }
                        Text("Consultar tarjeta", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                        Text("Aproxime la tarjeta para consultar el nombre, puesto, horario e ID del empleado.")
                        Button(onClick = { waitForCard() }, enabled = !loading && readKey.size == 6, modifier = Modifier.fillMaxWidth()) { Text("Leer tarjeta") }
                        if (waiting || loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(status, style = MaterialTheme.typography.titleMedium)
                                if (content.isNotEmpty()) Text(content)
                            }
                        }
                    }
                }
            }
        }
    }
    override fun onResume() {
        super.onResume()
        if (adapter?.isEnabled == true) {
            adapter?.enableReaderMode(this, this, NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_NFC_F or NfcAdapter.FLAG_READER_NFC_V or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK, null)
        }
        waitForCard()
    }
    override fun onPause() {
        handler.removeCallbacks(noCard); waiting = false
        activeCard?.let { runCatching { it.close() } }
        adapter?.disableReaderMode(this)
        super.onPause()
    }
    override fun onTagDiscovered(tag: Tag) {
        if (!busy.compareAndSet(false, true)) return
        runOnUiThread { handler.removeCallbacks(noCard); waiting = false; loading = true; content = ""; status = "Tarjeta detectada. Leyendo los datos guardados…" }
        try {
            val key = readKey.copyOf()
            val card = MifareClassic.get(tag) ?: error("El teléfono no ofrece acceso al contenido MIFARE Classic de esta tarjeta.")
            activeCard = card
            val description = try {
                card.connect()
                CardCredentialReader.describe(CardCredentialReader.read(card, key))
            } finally { runCatching { card.close() }; activeCard = null }
            runOnUiThread { status = "Lectura terminada"; content = description }
        } catch (failure: Exception) {
            runOnUiThread { status = "No se pudo leer la credencial"; content = "Mantenga la tarjeta próxima al lector e intente nuevamente. Si el problema persiste, contacte a Administración." }
        } finally { busy.set(false); runOnUiThread { loading = false } }
    }
}