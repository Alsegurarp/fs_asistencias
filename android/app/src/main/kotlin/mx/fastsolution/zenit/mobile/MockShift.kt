package mx.fastsolution.zenit.mobile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Presentation-only flow. Never writes to the attendance queue or contacts the API. */
@Composable
internal fun MockShift(modifier: Modifier = Modifier, onClose: () -> Unit) {
    var enteredAt by rememberSaveable { mutableStateOf<Long?>(null) }
    var exitedAt by rememberSaveable { mutableStateOf<Long?>(null) }
    var scanning by rememberSaveable { mutableStateOf<String?>(null) }
    fun time(value: Long?): String = value?.let {
        Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("HH:mm:ss"))
    } ?: "—"
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("ZENIT", color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
        Text(when {
            exitedAt != null -> "Turno terminado"
            enteredAt != null -> "En turno"
            else -> "Comienza tu turno"
        }, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text("Roberto AR", style = MaterialTheme.typography.titleLarge)
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Tu jornada", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                ShiftDetail("Hora de entrada", "08:00")
                ShiftDetail("Checaste entrada", time(enteredAt))
                HorizontalDivider()
                ShiftDetail("Hora de salida", "16:00")
                ShiftDetail("Checaste salida", time(exitedAt))
                Text("Horario asignado · 08:00 a 16:00",
                    style = MaterialTheme.typography.bodySmall)
            }
        }
        when {
            exitedAt != null -> {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Salida confirmada", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        Text("Roberto AR · ${time(exitedAt)}")
                        Text("Tu jornada quedó registrada.")
                    }
                }
                OutlinedButton(onClick = { enteredAt = null; exitedAt = null; scanning = null },
                    modifier = Modifier.fillMaxWidth()) { Text("Iniciar otro turno") }
            }
            enteredAt != null -> {
                Text("Entrada confirmada a las ${time(enteredAt)}. Cuando termines, registra tu salida.")
                Button(onClick = { scanning = "salida" }, modifier = Modifier.fillMaxWidth()) { Text("Marcar salida") }
            }
            else -> {
                Text("Acerca tu tarjeta para registrar el inicio de tu jornada.")
                Button(onClick = { scanning = "entrada" }, modifier = Modifier.fillMaxWidth()) { Text("Marcar entrada") }
            }
        }
        TextButton(onClick = onClose) { Text("Volver al inicio") }
    }
    scanning?.let { kind ->
        AlertDialog(
            onDismissRequest = { scanning = null },
            title = { Text("Escanea tu tarjeta") },
            text = {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.large) {
                        Text("NFC", Modifier.padding(32.dp), style = MaterialTheme.typography.headlineLarge,
                            color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    }
                    Text("Acerca la tarjeta a la parte posterior del teléfono para marcar tu $kind.")
                    Text("Roberto AR · Tarjeta de asistencia", style = MaterialTheme.typography.labelMedium)
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (kind == "entrada" && enteredAt == null) enteredAt = System.currentTimeMillis()
                    if (kind == "salida" && enteredAt != null && exitedAt == null) exitedAt = System.currentTimeMillis()
                    scanning = null
                }) { Text("Continuar") }
            },
            dismissButton = { TextButton(onClick = { scanning = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun ShiftDetail(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Text(value, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
    }
}
