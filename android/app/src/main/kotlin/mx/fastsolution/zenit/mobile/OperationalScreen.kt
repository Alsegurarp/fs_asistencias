package mx.fastsolution.zenit.mobile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
internal fun OperationalScreen(
    state: CaptureUiState,
    weekState: PersonalWeekState,
    onLoadWeek: (String) -> Unit,
    onAcknowledgeWeek: (String, String, String) -> Unit,
    onShareWeek: (String) -> Unit,
    nfcAvailable: Boolean,
    locationGranted: Boolean,
    onRequestLocation: () -> Unit,
    onActivate: (String, String, Boolean) -> Unit,
    onSynchronize: () -> Unit,
    onRenewSession: () -> Unit,
    onSelectType: (String?) -> Unit,
    onOpenPresentation: () -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf("Inicio") }
    var baseUrl by remember(state.serverUrl) { mutableStateOf(state.serverUrl) }
    var code by rememberSaveable { mutableStateOf("") }
    var reenrolling by rememberSaveable { mutableStateOf(false) }
    var preservePending by rememberSaveable { mutableStateOf(false) }
    var selectedType by rememberSaveable { mutableStateOf<String?>(null) }
    var chooseType by remember { mutableStateOf(false) }
    var confirmChange by remember { mutableStateOf(false) }
    val tabs = buildList {
        add("Inicio")
        if (state.registered && state.personal) add("Mi semana")
        add("Actividad")
        add("Dispositivo")
    }
    LaunchedEffect(state.breakPolicy) {
        if (state.breakPolicy != "marked" && selectedType in setOf("break_start", "break_end")) selectedType = null
        onSelectType(selectedType)
    }
    LaunchedEffect(state.registered, state.personal) {
        if (tab !in tabs) tab = "Inicio"
    }
    MaterialTheme(colorScheme = ZenitColors) {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            modifier = Modifier.safeDrawingPadding().imePadding(),
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    tabs.forEach { label ->
                        NavigationBarItem(
                            selected = tab == label,
                            onClick = { tab = label },
                            icon = { SectionIcon(label) },
                            label = { Text(label, maxLines = 1) },
                        )
                    }
                }
            },
        ) { insets ->
            Column(Modifier.fillMaxSize().padding(insets)) {
                Surface(color = MaterialTheme.colorScheme.surface) {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 14.dp)) {
                        Text("ZENIT", style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                        Text(tab, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text(if (state.registered) state.deviceLabel else "Control de asistencia",
                            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Column(
                    Modifier.weight(1f).verticalScroll(remember(tab) { ScrollState(0) })
                        .padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    val routineMessage = state.message in setOf("Aproxime una tarjeta NFC al lector", "Dispositivo activado. Aproxime una tarjeta NFC al lector.",
                        "Sincronización solicitada. Los marcajes permanecen guardados hasta recibir confirmación.")
                    // Failures remain visible everywhere; routine feedback belongs in Activity.
                    if (state.message.isNotBlank() && !routineMessage) {
                        Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(12.dp)) {
                            Text(state.message, Modifier.fillMaxWidth().padding(14.dp),
                                style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    if ((!state.registered && tab == "Inicio") || tab == "Dispositivo" && reenrolling) {
                        SectionCard("Vinculación del dispositivo", "Solicite a Recursos Humanos un código de vinculación personal o de terminal.") {
                            OutlinedTextField(baseUrl, { baseUrl = it }, label = { Text("Servidor") },
                                singleLine = true, enabled = !state.isCapturing, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(code, { code = it }, label = { Text("Código de vinculación") },
                                placeholder = { Text("XXXXX-XXXXX") }, singleLine = true,
                                enabled = !state.isCapturing, modifier = Modifier.fillMaxWidth())
                            if (state.pendingCount > 0) {
                                Text("Sincronice los registros antes de cambiar la vinculación o consérvelos para revisión. No se enviarán con la nueva clave.")
                                Row {
                                    Checkbox(preservePending, { preservePending = it }, enabled = !state.isCapturing,
                                        modifier = Modifier.semantics { contentDescription = "Conservar los pendientes anteriores sin enviarlos" })
                                    Text("Conservar pendientes anteriores", Modifier.padding(top = 12.dp))
                                }
                            }
                            Button(onClick = { onActivate(baseUrl, code, preservePending); reenrolling = false; preservePending = false },
                                enabled = !state.isCapturing && code.isNotBlank() && (state.pendingCount == 0 || preservePending),
                                modifier = Modifier.fillMaxWidth()) { Text("Vincular teléfono") }
                            if (state.registered) TextButton(onClick = { reenrolling = false; preservePending = false }) { Text("Cancelar") }
                        }
                    }
                    when (tab) {
                        "Inicio" -> {
                            if (state.registered) {
                                SectionCard("Registro de asistencia", "Aproxime la tarjeta al lector ubicado en la parte posterior del dispositivo.") {
                                    val ready = nfcAvailable && locationGranted && state.sessionUsable
                                    Text(when {
                                        !state.sessionUsable -> "La sesión requiere renovación"
                                        !nfcAvailable -> "El lector NFC requiere activación"
                                        !locationGranted -> "Se requiere autorización de ubicación"
                                        else -> "Lector disponible"
                                    },
                                        style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                                    val types = linkedMapOf<String?, String>(null to "Deducir tipo al leer tarjeta", "clock_in" to "Entrada", "clock_out" to "Salida")
                                    if (state.breakPolicy == "marked") {
                                        types["break_start"] = "Inicio de descanso"
                                        types["break_end"] = "Fin de descanso"
                                    }
                                    Text(if (selectedType == null) "El tipo de registro se determina al leer la tarjeta."
                                        else "Tipo de registro seleccionado: ${types[selectedType]}", style = MaterialTheme.typography.bodyMedium)
                                    TextButton(onClick = { chooseType = true }, enabled = !state.isCapturing) { Text("Seleccionar tipo de registro") }
                                    if (!ready) Button(onClick = { tab = "Dispositivo" }, modifier = Modifier.fillMaxWidth()) { Text("Revisar configuración") }
                                    if (BuildConfig.DEBUG) Text("Versión de prueba · sólo datos ficticios",
                                        style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    if (chooseType) AlertDialog(onDismissRequest = { chooseType = false }, title = { Text("Tipo de registro de asistencia") },
                                        text = { Column(Modifier.verticalScroll(remember(tab) { ScrollState(0) })) {
                                            types.forEach { (value, label) ->
                                                TextButton(onClick = { selectedType = value; onSelectType(value); chooseType = false },
                                                    modifier = Modifier.fillMaxWidth()) {
                                                    Text((if (selectedType == value) "✓ " else "") + if (value == null) "Determinar el tipo de registro" else label)
                                                }
                                            }
                                        } }, confirmButton = { TextButton(onClick = { chooseType = false }) { Text("Cancelar") } })
                                }
                            }
                            SectionCard(if (state.pendingCount == 0) "Registros sincronizados" else "Registros pendientes de envío",
                                if (state.pendingCount == 0) "No hay registros pendientes de envío." else "${state.pendingCount} registros pendientes. Se requiere conexión a internet para completar el envío.") {
                                if (state.registered && state.pendingCount > 0) Button(onSynchronize, enabled = !state.isCapturing,
                                    modifier = Modifier.fillMaxWidth()) { Text("Enviar pendientes") }
                                TextButton(onClick = { tab = "Actividad" }) { Text("Ver mi actividad") }
                            }
                        }
                        "Mi semana" -> if (state.registered && state.personal && !reenrolling) {
                            PersonalWeekScreen(weekState, state.pendingCount, onLoadWeek, onAcknowledgeWeek, onShareWeek)
                        } else Text("Complete la vinculación para consultar el resumen semanal.")
                        "Actividad" -> {
                            SectionCard(if (state.pendingCount == 0) "Sin registros pendientes" else "Pendientes de envío",
                                if (state.pendingCount == 0) "No hay registros pendientes de sincronización." else "${state.pendingCount} registros de asistencia pendientes de recepción en el servidor.") {
                                if (state.registered && state.pendingCount > 0) Button(onSynchronize, enabled = !state.isCapturing,
                                    modifier = Modifier.fillMaxWidth()) { Text("Enviar pendientes") }
                                if (state.legacyCount > 0) Text("${state.legacyCount} registros anteriores conservados para revisión con Recursos Humanos. No se envían desde este vínculo.",
                                    color = MaterialTheme.colorScheme.error)
                            }
                            Text("Registros recientes", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            if (state.receipts.isEmpty()) SectionCard("Sin registros confirmados", "En esta sección se mostrarán las confirmaciones de recepción de los registros de asistencia.") {}
                            state.receipts.forEach { receipt ->
                                val detail = receipt.substringAfter(" · ")
                                val preview = if (detail.startsWith("Rechazado:")) detail.substringBeforeLast(" (") else detail
                                ExpandablePanel(receipt.substringBefore(" · "), if (preview.length > 90) preview.take(90) + "…" else preview) { Text(receipt) }
                            }
                            if (routineMessage && state.message.isNotBlank()) ExpandablePanel("Última actualización") { Text(state.message) }
                        }
                        "Dispositivo" -> {
                            SectionCard("Estado del teléfono", if (state.registered) "Vinculado a la empresa" else "Sin vincular") {
                                DetailRow("Lector NFC", if (nfcAvailable) "Disponible" else "No disponible")
                                DetailRow("Ubicación", if (locationGranted) "Permitida" else "Sin permiso")
                                if (!locationGranted) OutlinedButton(onRequestLocation, modifier = Modifier.fillMaxWidth()) { Text("Permitir ubicación") }
                                if (!nfcAvailable) Text("La consulta semanal no requiere NFC. Para registrar asistencia sin tarjeta, consulte con Recursos Humanos el método alternativo autorizado.", style = MaterialTheme.typography.bodySmall)
                                if (state.registered) {
                                    DetailRow("Sesión de captura", if (state.sessionUsable) "Vigente" else "Requiere renovación")
                                    if (!state.sessionUsable) Button(onRenewSession, enabled = !state.isCapturing && state.pendingCount == 0,
                                        modifier = Modifier.fillMaxWidth()) { Text("Renovar sesión de asistencia") }
                                    if (!state.sessionUsable && state.pendingCount > 0) Text("Envíe los registros pendientes desde Actividad antes de renovar la sesión.", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                            if (state.registered) ExpandablePanel("Opciones del teléfono", "Conexión y cambio de vinculación") {
                                Text("Servidor: ${state.serverUrl}", style = MaterialTheme.typography.bodySmall)
                                OutlinedButton(onRenewSession, enabled = !state.isCapturing && state.pendingCount == 0,
                                    modifier = Modifier.fillMaxWidth()) { Text("Renovar sesión") }
                                if (!reenrolling) TextButton(onClick = { confirmChange = true }, enabled = !state.isCapturing) { Text("Cambiar vinculación") }
                                if (BuildConfig.DEBUG) {
                                    Text("La captura por UID está en validación y sólo admite datos ficticios.", style = MaterialTheme.typography.bodySmall)
                                    TextButton(onOpenPresentation) { Text("Ver presentación con ejemplos") }
                                }
                            }
                            if (!state.registered) Button(onClick = { tab = "Inicio" }, modifier = Modifier.fillMaxWidth()) { Text("Ir a vinculación") }
                            if (confirmChange) AlertDialog(onDismissRequest = { confirmChange = false },
                                title = { Text("¿Cambiar la vinculación?") },
                                text = { Text("El cambio de vinculación no es necesario para consultar el resumen semanal ni renovar la sesión. Continúe únicamente si dispone de un código nuevo proporcionado por Recursos Humanos.") },
                                confirmButton = { TextButton(onClick = { confirmChange = false; code = ""; preservePending = false; reenrolling = true }) { Text("Continuar con un código nuevo") } },
                                dismissButton = { TextButton(onClick = { confirmChange = false }) { Text("Conservar vinculación") } })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, description: String, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            content()
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Column(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun SectionIcon(label: String) {
    val color = LocalContentColor.current
    Canvas(Modifier.size(24.dp)) {
        val unit = size.width / 24
        fun line(x: Float, y: Float, x2: Float, y2: Float) = drawLine(color,
            Offset(x * unit, y * unit), Offset(x2 * unit, y2 * unit), 1.8f * unit)
        when (label) {
            "Inicio" -> {
                line(3f, 11f, 12f, 3f); line(12f, 3f, 21f, 11f)
                line(6f, 10f, 6f, 21f); line(6f, 21f, 18f, 21f); line(18f, 21f, 18f, 10f)
            }
            "Actividad" -> for (y in listOf(6f, 12f, 18f)) {
                drawCircle(color, unit, Offset(4 * unit, y * unit)); line(8f, y, 21f, y)
            }
            else -> {
                val phone = label == "Dispositivo"
                drawRoundRect(color, Offset((if (phone) 6 else 3) * unit, 3 * unit),
                    Size((if (phone) 12 else 18) * unit, 18 * unit), CornerRadius(2 * unit), style = Stroke(1.8f * unit))
                if (phone) line(10f, 18f, 14f, 18f) else {
                    line(3f, 9f, 21f, 9f); line(8f, 1f, 8f, 6f); line(16f, 1f, 16f, 6f)
                }
            }
        }
    }
}
