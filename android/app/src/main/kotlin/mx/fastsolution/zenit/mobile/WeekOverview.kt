package mx.fastsolution.zenit.mobile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private val weekLocale = Locale.forLanguageTag("es-MX")
private fun shortDate(date: LocalDate) = date.format(DateTimeFormatter.ofPattern("d MMM", weekLocale))
private fun duration(minutes: Int) = "${minutes / 60} h ${minutes % 60} min"

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun PersonalWeekScreen(state: PersonalWeekState, pending: Int, onLoad: (String) -> Unit,
    onAcknowledge: (String, String, String) -> Unit, onShare: (String) -> Unit) {
    var chooseDate by remember { mutableStateOf(false) }
    var selectedDate by rememberSaveable { mutableStateOf(state.week?.optString("weekStart") ?: LocalDate.now().toString()) }
    val week = state.week
    val start = week?.let { LocalDate.parse(it.getString("weekStart")) } ?: LocalDate.parse(selectedDate)
    LaunchedEffect(Unit) { if (state.week == null && !state.busy) onLoad(selectedDate) }
    fun load(date: LocalDate) { selectedDate = date.toString(); onLoad(selectedDate) }
    InfoPanel("${shortDate(start)} – ${shortDate(start.plusDays(6))} · ${start.year}") {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { load(start.minusWeeks(1)) }, enabled = !state.busy,
                modifier = Modifier.semantics { contentDescription = "Semana anterior" }) { Text("‹", style = MaterialTheme.typography.headlineSmall) }
            TextButton(onClick = { chooseDate = true }, enabled = !state.busy,
                modifier = Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 2.dp)) { Text("Elegir fecha") }
            IconButton(onClick = { load(start.plusWeeks(1)) }, enabled = !state.busy,
                modifier = Modifier.semantics { contentDescription = "Semana siguiente" }) { Text("›", style = MaterialTheme.typography.headlineSmall) }
            IconButton(onClick = { load(start) }, enabled = !state.busy,
                modifier = Modifier.semantics { contentDescription = "Actualizar semana" }) { Text("↻", style = MaterialTheme.typography.titleLarge) }
        }
        if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    }
    if (chooseDate) {
        val calendar = rememberDatePickerState(initialSelectedDateMillis = start.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(onDismissRequest = { chooseDate = false },
            confirmButton = { TextButton(onClick = {
                calendar.selectedDateMillis?.let { load(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                chooseDate = false
            }, enabled = calendar.selectedDateMillis != null && !state.busy) { Text("Ver semana") } },
            dismissButton = { TextButton(onClick = { chooseDate = false }) { Text("Cancelar") } }) {
            DatePicker(state = calendar, title = { Text("Seleccionar fecha de consulta", Modifier.padding(24.dp)) },
                headline = { Text(calendar.selectedDateMillis?.let { shortDate(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) } ?: "Seleccionar una fecha",
                    Modifier.padding(horizontal = 24.dp), style = MaterialTheme.typography.headlineMedium) }, showModeToggle = false)
        }
    }
    if (state.message.isNotBlank()) InfoPanel("Estado de la consulta", state.message) {}
    if (pending > 0) InfoPanel("Registros pendientes de envío", "$pending pendientes. El resumen se actualizará cuando se sincronicen.") {}
    if (week == null) {
        if (!state.busy && state.message.isBlank()) Text("El resumen se mostrará al actualizar la consulta semanal.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    val totals = week.getJSONObject("totals")
    val closure = week.optJSONObject("closure")
    val closed = closure?.optString("status") == "closed"
    val acknowledgement = state.acknowledgement
    val segments = week.getJSONArray("segments")
    val zone = ZoneId.of(week.getString("timeZone"))
    val days = (0 until segments.length()).map { segments.getJSONObject(it) }
        .groupBy { Instant.parse(it.getString("startAt")).atZone(zone).toLocalDate() }.toSortedMap()
    val incidents = week.getJSONArray("openIncidentIds").length()
    val alerts = week.getJSONArray("alerts")
    if (days.isEmpty() && closure == null && incidents == 0 && alerts.length() == 0 &&
        listOf("workedMinutes", "breakMinutes", "ordinaryMinutes", "overtimeMinutes").all { totals.getInt(it) == 0 }) {
        InfoPanel("Sin registros de asistencia", "Los registros recibidos durante este período se mostrarán en el resumen semanal.") {}
        ExpandablePanel("Más opciones", "Ayuda y copia del resumen") {
            Text("Si ya registró su asistencia, consulte Actividad para verificar los envíos pendientes. Si los registros no aparecen, contacte a Recursos Humanos.")
            Text("Una semana sin registros no determina una falta injustificada.")
            OutlinedButton(onClick = { onShare(personalWeekReport(week, acknowledgement)) }, modifier = Modifier.fillMaxWidth()) { Text("Compartir resumen") }
        }
        return
    }
    InfoPanel(if (closed) "Semana cerrada" else if (closure == null) "Semana sin cerrar" else "Semana reabierta") {
        Text(duration(totals.getInt("workedMinutes")), style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        Text("Tiempo trabajado", style = MaterialTheme.typography.bodyMedium)
        Text("Descansos: ${duration(totals.getInt("breakMinutes"))}", style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (totals.getInt("overtimeMinutes") > 0) Text("Incluye ${duration(totals.getInt("overtimeMinutes"))} extraordinarias",
            style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        Text(if (closed) "Esta versión del resumen semanal se encuentra cerrada." else "Los totales son provisionales. El cierre aún no está disponible para revisión.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (incidents > 0 || alerts.length() > 0) ExpandablePanel("Hay información por revisar",
        "$incidents incidencias abiertas · ${alerts.length()} avisos") {
        if (incidents > 0) Text("Consulte con Recursos Humanos las incidencias pendientes de este período.")
        for (i in 0 until alerts.length()) Text(alerts.getJSONObject(i).getString("message"))
    }
    Text("Detalle de jornadas", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
    if (days.isEmpty()) InfoPanel("Sin registros de asistencia en el período", "No hay tramos registrados. Esto no determina una falta injustificada.") {}
    days.forEach { (day, items) ->
        val worked = items.filter { it.getString("kind") == "work" }.sumOf { it.getInt("minutes") }
        ExpandablePanel(day.format(DateTimeFormatter.ofPattern("EEEE d MMM", weekLocale)),
            "${duration(worked)} trabajados${if (items.any { it.isNull("endAt") }) " · Registro incompleto" else ""}") {
            items.forEach { item ->
                fun time(value: String) = Instant.parse(value).atZone(zone).format(DateTimeFormatter.ofPattern("HH:mm"))
                val end = if (item.isNull("endAt")) "Sin salida registrada" else {
                    val endAt = Instant.parse(item.getString("endAt")).atZone(zone)
                    if (endAt.toLocalDate() == day) time(item.getString("endAt"))
                    else "${shortDate(endAt.toLocalDate())}, ${time(item.getString("endAt"))}"
                }
                Text(if (item.getString("kind") == "work") "Trabajo" else "Descanso", fontWeight = FontWeight.SemiBold)
                Text("${time(item.getString("startAt"))} → $end · ${duration(item.getInt("minutes"))}")
            }
            Text("Horas de $zone", style = MaterialTheme.typography.bodySmall)
        }
    }
    var showResponse by remember(week) { mutableStateOf(false) }
    var note by remember(closure?.optString("id")) { mutableStateOf("") }
    var reviewed by remember(week) { mutableStateOf(false) }
    var confirmation by remember(week) { mutableStateOf<String?>(null) }
    if (acknowledgement != null) InfoPanel("Respuesta registrada",
        if (acknowledgement.getString("type") == "agreed") "Se registró la conformidad con el cierre." else "Se registró una discrepancia para revisión de Recursos Humanos.") {
        Text(Instant.parse(acknowledgement.getString("at")).atZone(zone)
            .format(DateTimeFormatter.ofPattern("d MMM yyyy · HH:mm", weekLocale)), style = MaterialTheme.typography.bodySmall)
    } else if (closed && state.allowAcknowledgement) {
        InfoPanel("Revisión del cierre", "Revise las jornadas y los totales antes de expresar conformidad o informar una discrepancia.") {
            Button(onClick = { showResponse = true }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Responder al cierre") }
        }
    }
    ExpandablePanel("Más sobre esta semana", "Distribución de horas y referencia del cierre") {
        Text("Ordinarias: ${duration(totals.getInt("ordinaryMinutes"))}")
        Text("Extraordinarias: ${duration(totals.getInt("overtimeMinutes"))}")
        Text("Estos totales son informativos y están sujetos a revisión; no equivalen a una liquidación de nómina.")
        if (closure != null) Text("Versión ${closure.getInt("version")} · Referencia: ${closure.getString("id")}")
        if (acknowledgement != null) {
            if (!acknowledgement.isNull("note")) Text("Comentario registrado: ${acknowledgement.getString("note")}")
            Text("Acuse: ${acknowledgement.getString("id")}\nReferencia: ${acknowledgement.getString("evidenceHash")}")
        }
        Text("Esta consulta no incluye el expediente completo de ajustes. Puede solicitar su revisión a Recursos Humanos.")
    }
    OutlinedButton(onClick = { onShare(personalWeekReport(week, acknowledgement)) }, enabled = !state.busy,
        modifier = Modifier.fillMaxWidth()) { Text("Compartir resumen") }
    if (showResponse) AlertDialog(onDismissRequest = { showResponse = false }, title = { Text("Revisión previa a la respuesta") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("${shortDate(start)} – ${shortDate(start.plusDays(6))} · ${duration(totals.getInt("workedMinutes"))} trabajados")
                Text("Ordinarias: ${duration(totals.getInt("ordinaryMinutes"))}\nExtraordinarias: ${duration(totals.getInt("overtimeMinutes"))}")
                Text("La respuesta no implica renuncia de derechos ni confirma el pago de salarios. Se admite una respuesta por versión del cierre.")
                Row(Modifier.fillMaxWidth().toggleable(reviewed, enabled = !state.busy, role = Role.Checkbox,
                    onValueChange = { reviewed = it }), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(reviewed, onCheckedChange = null)
                    Text("He revisado las jornadas y los totales", Modifier.weight(1f))
                }
                OutlinedTextField(note, { if (it.length <= 500) note = it }, label = { Text("Comentario opcional") },
                    supportingText = { Text("${note.length}/500") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                if (pending > 0) Text("Es necesario sincronizar los registros pendientes antes de expresar conformidad. La opción para informar una discrepancia permanece disponible.")
                Button(onClick = { confirmation = "agreed" }, enabled = reviewed && !state.busy && pending == 0,
                    modifier = Modifier.fillMaxWidth()) { Text("Estoy conforme") }
                OutlinedButton(onClick = { confirmation = "objected" }, enabled = reviewed && !state.busy,
                    modifier = Modifier.fillMaxWidth()) { Text("Reportar diferencia") }
            }
        }, confirmButton = { TextButton(onClick = { showResponse = false }) { Text("Volver al resumen") } })
    confirmation?.let { type ->
        AlertDialog(onDismissRequest = { confirmation = null }, title = { Text("Confirmar respuesta") },
            text = { Text("${shortDate(start)} – ${shortDate(start.plusDays(6))} · Versión ${closure?.optInt("version")}\n${if (type == "agreed") "Estoy conforme" else "Reporto una diferencia"}\n$note\nLa respuesta se enviará al servidor y no podrá modificarse desde la aplicación.") },
            confirmButton = { TextButton(onClick = {
                confirmation = null; showResponse = false
                onAcknowledge(closure!!.getString("id"), type, note)
            }) { Text("Enviar respuesta") } },
            dismissButton = { TextButton(onClick = { confirmation = null }) { Text("Volver a revisar") } })
    }
}
