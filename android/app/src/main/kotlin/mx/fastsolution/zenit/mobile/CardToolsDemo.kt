package mx.fastsolution.zenit.mobile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** Local interaction design only; never reads or modifies a physical NFC tag. */
@Composable
internal fun CardToolsDemo(
    modifier: Modifier = Modifier,
    employees: List<Pair<String, String>>,
    initialEmployee: String?,
    onClose: () -> Unit,
) {
    var operation by rememberSaveable { mutableStateOf("Leer") }
    var employee by rememberSaveable { mutableStateOf(initialEmployee ?: employees.firstOrNull()?.first.orEmpty()) }
    var label by rememberSaveable { mutableStateOf("ZEN-0001") }
    var content by rememberSaveable { mutableStateOf("Credencial de asistencia") }
    var savedLabel by rememberSaveable { mutableStateOf("ZEN-0001") }
    var savedEmployee by rememberSaveable { mutableStateOf(initialEmployee ?: employees.firstOrNull()?.first.orEmpty()) }
    var savedContent by rememberSaveable { mutableStateOf("Credencial de asistencia") }
    var read by rememberSaveable { mutableStateOf(false) }
    var result by rememberSaveable { mutableStateOf("") }
    var pending by rememberSaveable { mutableStateOf<String?>(null) }
    var choosingEmployee by rememberSaveable { mutableStateOf(false) }
    BackHandler(onBack = onClose)

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        TextButton(onClick = onClose) { Text("Volver a administración") }
        Text("TARJETAS NFC", color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
        Text("Credenciales del personal", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text("Consulta y preparación de credenciales del personal.")
        Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.medium) {
            Text("Demostración · Las acciones sólo cambian esta tarjeta de ejemplo. No se usa el NFC ni se guarda en el servidor.",
                Modifier.padding(16.dp), style = MaterialTheme.typography.bodySmall)
        }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
            Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("ZENIT                                      NFC", fontWeight = FontWeight.Bold)
                Text(if (savedContent.isEmpty()) "Tarjeta vacía" else savedLabel,
                    style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(if (savedContent.isEmpty()) "Lista para preparar" else
                    employees.firstOrNull { it.first == savedEmployee }?.second ?: "Sin titular")
                Text("Credencial de ejemplo", style = MaterialTheme.typography.labelSmall)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Leer", "Escribir", "Borrar").forEach { action ->
                FilterChip(selected = operation == action, onClick = { operation = action; result = "" },
                    label = { Text(action) }, modifier = Modifier.weight(1f))
            }
        }
        when (operation) {
            "Leer" -> {
                Text("Consultar contenido", style = MaterialTheme.typography.titleLarge)
                Text("En el flujo final acercarás la tarjeta a la parte posterior del teléfono.")
                Button(onClick = { read = true; result = "Lectura de ejemplo completada." }, modifier = Modifier.fillMaxWidth()) {
                    Text("Simular lectura")
                }
                if (read) {
                    Text("Última lectura de ejemplo", fontWeight = FontWeight.SemiBold)
                    Text(if (savedContent.isEmpty()) "Sin datos" else "$savedLabel\n$savedEmployee\n$savedContent")
                }
            }
            "Escribir" -> {
                Text("Prepara una credencial", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(label, { label = it.take(40) }, label = { Text("Número de tarjeta") },
                    singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedButton(onClick = { choosingEmployee = true }, modifier = Modifier.fillMaxWidth()) {
                    Text(employees.firstOrNull { it.first == employee }?.let { "${it.second} · ${it.first}" } ?: "Seleccionar empleado")
                }
                OutlinedTextField(content, { content = it.take(200) }, label = { Text("Datos de ejemplo") },
                    supportingText = { Text("${content.length}/200 caracteres") }, modifier = Modifier.fillMaxWidth())
                Text("Revise el titular y los datos antes de reemplazar el contenido existente.", style = MaterialTheme.typography.bodySmall)
                Button(onClick = { pending = "Escribir" }, enabled = label.isNotBlank() && content.isNotBlank() && employees.any { it.first == employee },
                    modifier = Modifier.fillMaxWidth()) { Text("Revisar escritura") }
            }
            else -> {
                Text("Borra el contenido", style = MaterialTheme.typography.titleLarge)
                Text("Vacía los datos de la tarjeta de ejemplo. La baja o revocación de una credencial se gestiona por separado.")
                Button(onClick = { pending = "Borrar" }, enabled = savedContent.isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.fillMaxWidth()) { Text("Borrar datos de ejemplo") }
            }
        }
        if (result.isNotEmpty()) Surface(color = MaterialTheme.colorScheme.tertiaryContainer, shape = MaterialTheme.shapes.medium) {
            Text(result, Modifier.fillMaxWidth().padding(16.dp))
        }
        Text("Datos de ejemplo para presentación.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (choosingEmployee) AlertDialog(onDismissRequest = { choosingEmployee = false },
        title = { Text("Seleccionar empleado") }, text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                employees.forEach { (number, name) ->
                    TextButton(onClick = { employee = number; choosingEmployee = false }) { Text("$name · $number") }
                }
            }
        }, confirmButton = { TextButton(onClick = { choosingEmployee = false }) { Text("Cerrar") } })
    pending?.let { action ->
        AlertDialog(onDismissRequest = { pending = null },
            title = { Text(if (action == "Borrar") "¿Borrar datos de ejemplo?" else "Confirmar escritura de ejemplo") },
            text = { Text(if (action == "Borrar") "Se vaciará el contenido de $savedLabel en esta demostración." else
                "$label\n${employees.firstOrNull { it.first == employee }?.second} · $employee\n$content\n\nSe reemplazará el contenido de ejemplo.") },
            confirmButton = { TextButton(onClick = {
                if (action == "Borrar") {
                    savedContent = ""; savedEmployee = ""; read = false
                    result = "Datos de ejemplo borrados."
                } else {
                    savedLabel = label.trim(); savedEmployee = employee; savedContent = content.trim(); read = false
                    result = "Escritura de ejemplo completada."
                }
                pending = null
            }) { Text(if (action == "Borrar") "Simular borrado" else "Simular escritura") } },
            dismissButton = { TextButton(onClick = { pending = null }) { Text("Cancelar") } })
    }
}
