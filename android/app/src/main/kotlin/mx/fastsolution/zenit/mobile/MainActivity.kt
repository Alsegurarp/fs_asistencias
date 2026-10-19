package mx.fastsolution.zenit.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity(), NfcAdapter.ReaderCallback {
    private val viewModel: AttendanceViewModel by viewModels()
    private val nfcAdapter: NfcAdapter? by lazy { NfcAdapter.getDefaultAdapter(this) }
    private var locationGranted by mutableStateOf(false)
    private var nfcReady by mutableStateOf(false)

    private val requestLocationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants -> locationGranted = grants.values.any { it } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        locationGranted = hasLocationPermission()
        setContent {
            val state by viewModel.state.collectAsStateWithLifecycle()
            ZenitApp(
                state = state,
                onOpenPresentation = { startActivity(Intent(this, PresentationActivity::class.java)) },
                nfcAvailable = nfcReady,
                locationGranted = locationGranted,
                onActivate = viewModel::activate,
                onSynchronize = viewModel::synchronize,
                onRenewSession = viewModel::renewSession,
                onSelectType = viewModel::selectType,
                onRequestLocation = {
                    // Android 12+ ignora la solicitud si FINE se pide sin COARSE.
                    requestLocationPermission.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION,
                        ),
                    )
                },
            )
        }
    }

    override fun onResume() {
        super.onResume()
        locationGranted = hasLocationPermission()
        nfcReady = nfcAdapter?.isEnabled == true
        nfcAdapter?.enableReaderMode(
            this,
            this,
            NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_NFC_F or
                NfcAdapter.FLAG_READER_NFC_V or
                NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null,
        )
    }

    override fun onPause() {
        nfcAdapter?.disableReaderMode(this)
        nfcReady = false
        super.onPause()
    }

    override fun onTagDiscovered(tag: Tag) {
        viewModel.captureTag(tag.id)
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
}

@Composable
private fun ZenitApp(
    state: CaptureUiState,
    nfcAvailable: Boolean,
    locationGranted: Boolean,
    onRequestLocation: () -> Unit,
    onActivate: (String, String, Boolean) -> Unit,
    onSynchronize: () -> Unit,
    onRenewSession: () -> Unit,
    onSelectType: (String?) -> Unit,
    onOpenPresentation: () -> Unit,
) {
    var baseUrl by remember(state.serverUrl) { mutableStateOf(state.serverUrl) }
    var code by remember { mutableStateOf("") }
    var reenrolling by remember { mutableStateOf(false) }
    var preservePending by remember { mutableStateOf(false) }
    var selectedType by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(state.breakPolicy) {
        if (state.breakPolicy != "marked" && selectedType in setOf("break_start", "break_end")) selectedType = null
        onSelectType(selectedType)
    }
    MaterialTheme(colorScheme = ZenitColors) {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .safeDrawingPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "Zenit",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                if (BuildConfig.DEBUG) Button(onClick = onOpenPresentation) { Text("Ver presentación del producto") }
                if (BuildConfig.DEBUG) Text("Modo de pruebas: tarjetas simuladas. Sólo datos ficticios.", color = MaterialTheme.colorScheme.error)
                if (state.registered) Text(state.deviceLabel, style = MaterialTheme.typography.titleMedium)
                if (!state.registered || reenrolling) {
                    OutlinedTextField(value = baseUrl, onValueChange = { baseUrl = it }, label = { Text("Servidor") }, singleLine = true, enabled = !state.isCapturing, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = code, onValueChange = { code = it }, label = { Text("Código de RH") }, placeholder = { Text("XXXXX-XXXXX") }, singleLine = true, enabled = !state.isCapturing, modifier = Modifier.fillMaxWidth())
                    if (state.pendingCount > 0) {
                        Text("Cambiar de dispositivo impide enviar sus pendientes con la nueva clave. Puedes sincronizarlos primero o conservarlos para revisión.")
                        Checkbox(checked = preservePending, onCheckedChange = { preservePending = it }, enabled = !state.isCapturing,
                            modifier = Modifier.semantics { contentDescription = "Conservar los pendientes anteriores sin enviarlos" })
                        Text("Conservar los pendientes anteriores sin enviarlos")
                    }
                    Button(enabled = !state.isCapturing && code.isNotBlank() && (state.pendingCount == 0 || preservePending), onClick = { onActivate(baseUrl, code, preservePending); reenrolling = false; preservePending = false }) { Text("Activar dispositivo") }
                    if (state.registered) Button(onClick = { reenrolling = false; preservePending = false }) { Text("Cancelar") }
                }
                StatusCard(
                    title = "Lector NFC",
                    value = if (nfcAvailable) "Listo" else "No disponible",
                )
                Spacer(modifier = Modifier.height(12.dp))
                StatusCard(
                    title = "Ubicacion puntual",
                    value = if (locationGranted) "Permitida" else "Sin permiso",
                )
                if (!locationGranted) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(onClick = onRequestLocation) {
                        Text("Permitir ubicacion")
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = state.message,
                    style = MaterialTheme.typography.bodyLarge,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Pendientes de sincronizar: ${state.pendingCount}",
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (state.legacyCount > 0) Text("Registros conservados fuera de sincronización: ${state.legacyCount}. Son registros anteriores sin firma o de un dispositivo previo; requieren revisión.", color = MaterialTheme.colorScheme.error)
                if (state.registered) {
                    if (!state.sessionUsable) Text("La sesión requiere renovación antes de seguir marcando.", color = MaterialTheme.colorScheme.error)
                    Text("Tipo de marcaje", style = MaterialTheme.typography.titleSmall)
                    val types = linkedMapOf<String?, String>(null to "Automático", "clock_in" to "Entrada", "clock_out" to "Salida")
                    if (state.breakPolicy == "marked") { types["break_start"] = "Inicio de descanso"; types["break_end"] = "Fin de descanso" }
                    types.forEach { (value, label) ->
                        FilterChip(selected = selectedType == value, enabled = !state.isCapturing, onClick = { selectedType = value; onSelectType(value) }, label = { Text(label) })
                    }
                    Button(enabled = !state.isCapturing, onClick = onSynchronize) { Text("Sincronizar ahora") }
                    Button(enabled = !state.isCapturing && state.pendingCount == 0, onClick = onRenewSession) { Text("Renovar sesión") }
                    Button(enabled = !state.isCapturing, onClick = { code = ""; preservePending = false; reenrolling = true }) { Text("Usar otro código de RH") }
                }
                if (state.receipts.isNotEmpty()) {
                    Text("Últimos recibos", style = MaterialTheme.typography.titleMedium)
                    state.receipts.forEach { receipt -> StatusCard("Resultado del servidor", receipt) }
                }
            }
        }
    }
}

@Composable
private fun StatusCard(title: String, value: String) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = title, style = MaterialTheme.typography.labelLarge)
            Text(text = value, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
