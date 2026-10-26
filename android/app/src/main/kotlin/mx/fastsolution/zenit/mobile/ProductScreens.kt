package mx.fastsolution.zenit.mobile

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
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun ProductApp(
    activation: ActivationUiState,
    pendingCount: Int,
    onActivate: (String, String) -> Unit,
    nfcReady: Boolean,
    locationGranted: Boolean,
    onRequestLocation: () -> Unit,
) {
    var page by rememberSaveable { mutableStateOf("Inicio") }
    var showMock by rememberSaveable { mutableStateOf(false) }
    var showAdmin by rememberSaveable { mutableStateOf(false) }
    val terminal = activation.mode == "terminal"
    val pages = if (terminal) listOf("Inicio", "Actividad", "Dispositivo")
        else listOf("Inicio", "Mi semana", "Actividad", "Dispositivo")
    val selectedPage = if (page in pages) page else "Inicio"
    MaterialTheme(colorScheme = ZenitColors) {
        if (showAdmin) {
            AdminDemo(onClose = { showAdmin = false })
            return@MaterialTheme
        }
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    pages.forEach { destination ->
                        NavigationBarItem(
                            selected = selectedPage == destination, onClick = { page = destination; showMock = false; showAdmin = false },
                            icon = { NavigationGlyph(destination) },
                            label = { Text(destination) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                selectedTextColor = MaterialTheme.colorScheme.primary,
                                indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                        )
                    }
                }
            },
        ) { padding ->
            if (showMock) {
                MockShift(Modifier.padding(padding), onClose = { showMock = false })
                return@Scaffold
            }
            if (selectedPage == "Dispositivo") {
                Box(Modifier.padding(padding)) {
                    PresentationDevice(nfcReady, locationGranted, onRequestLocation)
                }
            } else {
                Column(
                    Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    Text("ZENIT / PERSONAL · DATOS DE EJEMPLO", style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    when (selectedPage) {
                        "Inicio" -> {
                            Heading("Hola, Roberto",
                                LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE d 'de' MMMM", Locale.forLanguageTag("es-MX"))))
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                                Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Text(if (terminal) "Punto de asistencia" else "Mi asistencia",
                                        style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                                    Text("Registro de entrada y salida mediante tarjeta.")
                                    Button(onClick = { showMock = true }, modifier = Modifier.fillMaxWidth()) {
                                        Text("Registrar asistencia")
                                    }
                                }
                            }
                            Panel("Jornada actual") {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Metric("Entrada", "08:00"); Metric("Salida", "16:00"); Metric("Sede", "Centro")
                                }
                                Text("Turno de 8 horas · Tarjeta asignada", style = MaterialTheme.typography.bodySmall)
                            }
                            Panel("Espacio de trabajo") {
                                Text("Acceso al perfil de empleado.")
                                OutlinedButton(onClick = { showAdmin = true }, modifier = Modifier.fillMaxWidth()) {
                                    Text("Cambiar a Administración / RH")
                                }
                            }
                            Text("Roberto AR · Dispositivo vinculado", style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        "Mi semana" -> {
                            PersonalWeek()
                        }
                        else -> {
                            PersonalActivity()
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Heading(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Panel(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}

@Composable
private fun Metric(label: String, value: String) {
    Column {
        Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
        Text(label, style = MaterialTheme.typography.labelMedium)
    }
}
