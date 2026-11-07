package mx.fastsolution.zenit.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
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
            MaterialTheme(colorScheme = ZenitColors, shapes = ZenitShapes) {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
                        ZenitHeader(if (welcome) "Tu jornada, en un solo lugar" else "Bienvenido",
                            if (welcome) "Control de asistencia" else "Elige cómo quieres ingresar", home = true)
                        Column(Modifier.weight(1f).offset(y = (-24).dp).clip(ZenitBodyShape)
                            .background(MaterialTheme.colorScheme.background).verticalScroll(rememberScrollState()).padding(24.dp),
                            verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        if (welcome) {
                            NfcIllustration(Modifier.align(androidx.compose.ui.Alignment.CenterHorizontally))
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("Gestión del personal", style = MaterialTheme.typography.titleLarge)
                                    Text("Administración del personal y registro de asistencia desde el dispositivo.")
                                }
                            }
                            ZenitPrimaryButton("Comenzar") { preferences.edit().putBoolean("completed", true).apply(); welcome = false }
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
                                }) { Text("Ver vistas de la app") }
                            }
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
