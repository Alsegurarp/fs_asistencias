package mx.fastsolution.zenit.mobile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

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
    MaterialTheme(colorScheme = ZenitColors, shapes = ZenitShapes) {
        if (showAdmin) {
            AdminDemo(onClose = { showAdmin = false })
            return@MaterialTheme
        }
        Scaffold(
            modifier = Modifier.safeDrawingPadding(),
            containerColor = MaterialTheme.colorScheme.background,
            bottomBar = {
                if (!showMock) NavigationBar(modifier = Modifier.clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)),
                    containerColor = MaterialTheme.colorScheme.surface) {
                    pages.forEach { destination ->
                        NavigationBarItem(
                            selected = selectedPage == destination,
                            onClick = { page = destination },
                            icon = { NavigationGlyph(destination) }, label = { Text(destination) },
                        )
                    }
                }
            },
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding)) {
                ZenitHeader(title = if (showMock) "Registrar asistencia" else if (selectedPage == "Inicio") "Hola, Roberto" else selectedPage,
                    subtitle = if (selectedPage == "Inicio" && !showMock) "fastSolution" else null,
                    home = selectedPage == "Inicio" && !showMock,
                    onBack = if (showMock) ({ showMock = false }) else if (selectedPage != "Inicio") ({ page = "Inicio" }) else null)
                Box(Modifier.weight(1f).offset(y = (-24).dp).clip(ZenitBodyShape).background(MaterialTheme.colorScheme.background)) {
                    if (showMock) {
                        MockShift(onClose = { showMock = false })
                    } else if (selectedPage == "Dispositivo") {
                        PresentationDevice(nfcReady, locationGranted, onRequestLocation)
                    } else Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        when (selectedPage) {
                            "Inicio" -> {
                                InfoPanel(if (terminal) "Punto de asistencia" else "Registrar asistencia",
                                    "Aproxime su tarjeta al lector NFC del dispositivo.") {
                                    ZenitIconTile("NFC")
                                    ZenitPrimaryButton("Registrar ahora") { showMock = true }
                                }
                                if (!terminal) ZenitLink("Mi semana", "Ver resumen de asistencias", "Mi semana") { page = "Mi semana" }
                                ZenitLink("Registros sincronizados", "No hay registros pendientes", "Actividad") { page = "Actividad" }
                                ZenitLink("Administración", "Empleados y asistencia del equipo", "Empleados") { showAdmin = true }
                            }
                            "Mi semana" -> PersonalWeek()
                            else -> PersonalActivity()
                        }
                    }
                }
            }
        }
    }
}
