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
                        Spacer(Modifier.height(8.dp))
                        Text("ZENIT", color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(if (welcome) "Control de jornada laboral" else "Seleccionar acceso",
                            style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text(if (welcome) "Registro de asistencia y administración del personal en una misma aplicación."
                            else "Seleccione el perfil correspondiente.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (welcome) {
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("Gestión del personal", style = MaterialTheme.typography.titleLarge)
                                    Text("Administración del personal y registro de asistencia desde el dispositivo.")
                                }
                            }
                            Button(onClick = { preferences.edit().putBoolean("completed", true).apply(); welcome = false },
                                modifier = Modifier.fillMaxWidth()) { Text("Comenzar") }
                        } else {
                            AccessCard("Mi asistencia", "Registro de asistencia y consulta del resumen semanal.", "Entrar como empleado") {
                                startActivity(Intent(this@WelcomeActivity, MainActivity::class.java))
                            }
                            AccessCard("Administración", "Administración de empleados, horarios y dispositivos de la empresa.", "Entrar a administración", primary = false) {
                                startActivity(Intent(this@WelcomeActivity, AdministrationActivity::class.java))
                            }
                            ExpandablePanel("Otras opciones", "Consultar tarjeta y ayuda de acceso") {
                                OutlinedButton(onClick = { startActivity(Intent(this@WelcomeActivity, NfcDiagnosticActivity::class.java)) },
                                    modifier = Modifier.fillMaxWidth()) { Text("Consultar tarjeta NFC") }
                                Text("Para acceder a Administración, utilice la cuenta proporcionada por la empresa. El acceso del empleado requiere un código de vinculación emitido por Recursos Humanos.",
                                    style = MaterialTheme.typography.bodySmall)
                                if (BuildConfig.DEBUG) TextButton(onClick = {
                                    startActivity(Intent(this@WelcomeActivity, PresentationActivity::class.java))
                                }) { Text("Ver presentación con ejemplos") }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AccessCard(title: String, description: String, action: String, primary: Boolean = true, onClick: () -> Unit) {
    InfoPanel(title, description) {
        if (primary) Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) { Text(action) }
        else OutlinedButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) { Text(action) }
    }
}
