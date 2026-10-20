package mx.fastsolution.zenit.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

class WelcomeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val preferences = getSharedPreferences("welcome", MODE_PRIVATE)
        setContent {
            var welcome by rememberSaveable { mutableStateOf(!preferences.getBoolean("completed", false)) }
            MaterialTheme(colorScheme = ZenitColors) {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(28.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        Spacer(Modifier.height(32.dp))
                        Text("ZENIT", color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(if (welcome) "Tu jornada, en orden." else "¿Cómo quieres acceder?",
                            style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                        Text(if (welcome) "Asistencia y equipo en un mismo lugar. Elige tu espacio y continúa en pocos pasos."
                            else "Elige el espacio que necesitas hoy.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (welcome) {
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("Para tu equipo", style = MaterialTheme.typography.titleLarge)
                                    Text("Administra tu equipo y registra tu asistencia desde el teléfono.")
                                }
                            }
                            Button(onClick = { preferences.edit().putBoolean("completed", true).apply(); welcome = false },
                                modifier = Modifier.fillMaxWidth()) { Text("Comenzar") }
                        } else {
                            AccessCard("Administración", "Gestiona tu empresa, empleados y dispositivos con tu cuenta.", "Acceder a Administración") {
                                startActivity(Intent(this@WelcomeActivity, AdministrationActivity::class.java))
                            }
                            AccessCard("Empleado", "Vincula este teléfono con el código que te entrega tu empresa y registra tu asistencia.", "Continuar como empleado") {
                                startActivity(Intent(this@WelcomeActivity, MainActivity::class.java))
                            }
                            OutlinedButton(onClick = { startActivity(Intent(this@WelcomeActivity, NfcDiagnosticActivity::class.java)) },
                                modifier = Modifier.fillMaxWidth()) { Text("Consultar tarjeta NFC") }
                            Text("¿Es tu primer acceso al portal? Usa la contraseña temporal que recibiste y sigue los pasos para actualizarla.",
                                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (BuildConfig.DEBUG) TextButton(onClick = {
                                startActivity(Intent(this@WelcomeActivity, PresentationActivity::class.java))
                            }) { Text("Explorar presentación · datos de ejemplo") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AccessCard(title: String, description: String, action: String, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(description)
            Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) { Text(action) }
        }
    }
}