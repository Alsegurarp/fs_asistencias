package mx.fastsolution.zenit.mobile

import android.Manifest
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {
    private val activationViewModel: ActivationViewModel by viewModels()
    private val attendanceViewModel: AttendanceViewModel by viewModels()
    private var locationGranted by mutableStateOf(false)
    private var nfcReady by mutableStateOf(false)
    private val requestLocationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants -> locationGranted = grants.values.any { it } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val activation by activationViewModel.state.collectAsStateWithLifecycle()
            val attendance by attendanceViewModel.state.collectAsStateWithLifecycle()
            ProductApp(activation, attendance.pendingCount, activationViewModel::activate, nfcReady, locationGranted) {
                requestLocationPermission.launch(arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ))
            }
        }
    }

    override fun onResume() {
        super.onResume()
        locationGranted = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            .any { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }
        nfcReady = NfcAdapter.getDefaultAdapter(this)?.isEnabled == true
    }
}

@Composable
internal fun DeviceSetup(
    activation: ActivationUiState,
    onActivate: (String, String) -> Unit,
    nfcReady: Boolean,
    locationGranted: Boolean,
    onRequestLocation: () -> Unit,
) {
    var server by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    MaterialTheme(colorScheme = ZenitColors) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(
                Modifier.safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()).padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("ZENIT", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                    Text("Tu jornada, en un solo lugar", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(if (activation.activated) "Teléfono vinculado" else "Comienza con tu organización",
                            style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        Text(activation.message, style = MaterialTheme.typography.bodyMedium)
                        if (!activation.activated) {
                            OutlinedTextField(
                                value = server, onValueChange = { server = it },
                                label = { Text("Servidor de tu organización") },
                                supportingText = { Text("Utiliza la dirección que te proporcionó tu organización.") },
                                singleLine = true, enabled = !activation.busy, modifier = Modifier.fillMaxWidth(),
                            )
                            OutlinedTextField(
                                value = code, onValueChange = { code = it },
                                label = { Text("Código de activación") },
                                singleLine = true, enabled = !activation.busy, modifier = Modifier.fillMaxWidth(),
                            )
                            Button(onClick = { onActivate(server, code) },
                                enabled = !activation.busy && server.isNotBlank() && code.trim().length in 6..32,
                                modifier = Modifier.fillMaxWidth()) {
                                Text(if (activation.busy) "Vinculando…" else "Vincular teléfono")
                            }
                            if (activation.busy) CircularProgressIndicator()
                        }
                    }
                }
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("Prepara tu teléfono", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        ReadinessRow("Lectura de tarjeta NFC", if (nfcReady) "Disponible" else "Activa NFC en ajustes")
                        HorizontalDivider()
                        ReadinessRow("Ubicación al marcar", if (locationGranted) "Permitida" else "Sin permiso")
                        if (!locationGranted) {
                            Text("La ubicación se solicita únicamente al registrar tu asistencia.",
                                style = MaterialTheme.typography.bodySmall)
                            TextButton(onClick = onRequestLocation) { Text("Permitir ubicación") }
                        }
                    }
                }
                Text("El registro de asistencia estará disponible en una próxima actualización.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Zenit · fastSolution", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun ReadinessRow(label: String, status: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        Text(status, modifier = Modifier.weight(1f).padding(start = 12.dp),
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
    }
}
