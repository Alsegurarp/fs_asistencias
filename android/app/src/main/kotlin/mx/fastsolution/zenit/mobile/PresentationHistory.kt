package mx.fastsolution.zenit.mobile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Locale

// In-memory presentation data. Does not create activations, receipts or attendance events.
internal data class PresentationDay(val date: LocalDate, val category: String, val entry: String?, val exit: String?)
private val displayDate = DateTimeFormatter.ofPattern("EEE d MMM", Locale.forLanguageTag("es-MX"))
internal val presentationMonthLabel: String
    get() = LocalDate.now().minusMonths(1).format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.forLanguageTag("es-MX")))

internal fun presentationDays(punctual: Int, late: Int, absent: Int, vacation: Int, justified: Int): List<PresentationDay> {
    val statuses = List(punctual) { "Puntual" } + List(late) { "Retardo" } + List(absent) { "Falta" } +
        List(vacation) { "Vacaciones" } + List(justified) { "Justificado" }
    val first = LocalDate.now().minusMonths(1).withDayOfMonth(1)
    val dates = generateSequence(first) { it.plusDays(1) }.takeWhile { it.month == first.month }
        .filter { it.dayOfWeek != DayOfWeek.SATURDAY && it.dayOfWeek != DayOfWeek.SUNDAY }.take(statuses.size).toList()
    return dates.mapIndexed { index, date ->
        val category = statuses[index]
        val entered = when (category) { "Puntual" -> LocalTime.of(8, index % 8); "Retardo" -> LocalTime.of(8, 14 + index % 6); else -> null }
        PresentationDay(date, category, entered?.toString(), entered?.plusHours(8)?.toString())
    }
}

private fun lastWeek(): List<PresentationDay> {
    val monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1)
    return (0..4).map { index ->
        val entry = if (index == 2) LocalTime.of(8, 14) else LocalTime.of(8, index)
        PresentationDay(monday.plusDays(index.toLong()), if (index == 2) "Retardo" else "Puntual", entry.toString(), entry.plusHours(8).toString())
    }
}

@Composable
internal fun HistoricalRows(days: List<PresentationDay>) {
    days.forEach { day ->
        HorizontalDivider()
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text(day.date.format(displayDate), fontWeight = FontWeight.SemiBold)
                Text(if (day.entry == null) "Sin marcajes" else "${day.entry} – ${day.exit}", style = MaterialTheme.typography.bodySmall)
            }
            Text(day.category, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
internal fun PersonalWeek() {
    var acknowledgement by rememberSaveable { mutableStateOf<String?>(null) }
    var objecting by rememberSaveable { mutableStateOf(false) }
    var note by rememberSaveable { mutableStateOf("") }
    val days = remember { lastWeek() }
    Text("Mi semana", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
    Text("${days.first().date.format(displayDate)} – ${days.last().date.format(displayDate)} · Roberto AR")
    HistoryPanel("Resumen semanal") {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            SummaryValue("Horas", "40 h"); SummaryValue("Jornadas", "5"); SummaryValue("Retardos", "1")
        }
        Text("4 entradas puntuales · 1 entrada fuera de tolerancia")
    }
    HistoryPanel("Detalle de jornada") { HistoricalRows(days) }
    HistoryPanel("Cierre de semana") {
        Text("Semana cerrada · 40 horas registradas")
        if (acknowledgement == null) {
            Button(onClick = { acknowledgement = "Cierre aceptado" }, modifier = Modifier.fillMaxWidth()) { Text("Estoy de acuerdo") }
            OutlinedButton(onClick = { objecting = true }, modifier = Modifier.fillMaxWidth()) { Text("Reportar una diferencia") }
        } else Text(acknowledgement!!, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
    }
    if (objecting) AlertDialog(onDismissRequest = { objecting = false }, title = { Text("Reportar una diferencia") },
        text = { OutlinedTextField(note, { note = it.take(500) }, label = { Text("Comentario") }, supportingText = { Text("${note.length}/500") }) },
        confirmButton = { TextButton(onClick = { acknowledgement = "Diferencia enviada para revisión"; objecting = false }) { Text("Enviar") } },
        dismissButton = { TextButton(onClick = { objecting = false }) { Text("Cancelar") } })
}

@Composable
internal fun PersonalActivity() {
    Text("Actividad", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
    Text("Tus últimos registros")
    HistoryPanel("Sincronización") {
        Text("Todo al día", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text("0 registros pendientes · Últimos marcajes confirmados")
    }
    HistoryPanel("Historial de asistencia") { HistoricalRows(lastWeek().reversed()) }
}

@Composable
internal fun PresentationDevice(nfcReady: Boolean, locationGranted: Boolean, onRequestLocation: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("Dispositivo", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        HistoryPanel("Dispositivo vinculado") {
            Text("Roberto AR", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text("Organización · Zenit")
            Text("Sede · Centro")
            Text("Modalidad · Personal")
            Text("Identificador · ZNT-MOV-001")
            Text("Estado · Activo", color = MaterialTheme.colorScheme.primary)
        }
        HistoryPanel("Configuración del teléfono") {
            Text("NFC · ${if (nfcReady) "Disponible" else "No disponible"}")
            Text("Ubicación · ${if (locationGranted) "Permitida" else "Sin permiso"}")
            if (!locationGranted) TextButton(onClick = onRequestLocation) { Text("Permitir ubicación") }
        }
    }
}

@Composable
private fun HistoryPanel(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}

@Composable
private fun SummaryValue(label: String, value: String) {
    Column { Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold); Text(label, style = MaterialTheme.typography.labelMedium) }
}
