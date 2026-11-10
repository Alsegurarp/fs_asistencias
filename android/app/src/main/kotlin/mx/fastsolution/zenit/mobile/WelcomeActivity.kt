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
                            if (welcome) "Control de asistencia" else "Consulta y registra tu asistencia", home = true)
                        Column(Modifier.weight(1f).offset(y = (-24).dp).clip(ZenitBodyShape)
                            .background(MaterialTheme.colorScheme.background).verticalScroll(rememberScrollState()).padding(24.dp),
                            verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        if (welcome) {
                            NfcIllustration(Modifier.align(androidx.compose.ui.Alignment.CenterHorizontally))
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("Tu asistencia", style = MaterialTheme.typography.titleLarge)
                                    Text("Registra tu asistencia y consulta tu resumen semanal desde el dispositivo.")
                                }
                            }
                            ZenitPrimaryButton("Comenzar") { preferences.edit().putBoolean("completed", true).apply(); welcome = false }
                        } else {
                            AccessCard("Mi asistencia", "Registra tu asistencia y consulta tu resumen semanal.", "Continuar") {
                                startActivity(Intent(this@WelcomeActivity, MainActivity::class.java))
                            }
                            ExpandablePanel("Ayuda de acceso", "Código de vinculación") {
                                Text("Para vincular tu teléfono por primera vez, solicita un código a Recursos Humanos. Si ya está vinculado, pulsa Continuar.",
                                    style = MaterialTheme.typography.bodySmall)
                                if (BuildConfig.DEBUG) TextButton(onClick = {
                                    startActivity(Intent(this@WelcomeActivity, PresentationActivity::class.java))
                                }) { Text("Explorar con datos de ejemplo") }
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
private fun AccessCard(title: String, description: String, action: String, onClick: () -> Unit) {
    InfoPanel(title, description) {
        Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) { Text(action) }
    }
}
