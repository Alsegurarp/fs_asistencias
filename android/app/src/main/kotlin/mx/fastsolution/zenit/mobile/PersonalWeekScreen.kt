package mx.fastsolution.zenit.mobile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class PersonalWeekState(
    val week: JSONObject? = null,
    val acknowledgement: JSONObject? = null,
    val busy: Boolean = false,
    val allowAcknowledgement: Boolean = true,
    val message: String = "",
)

@Composable
fun PersonalWeekScreen(state: PersonalWeekState, pending: Int, onLoad: (String) -> Unit,
    onAcknowledge: (String, String, String) -> Unit, onShare: (String) -> Unit) {
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Mi semana · registros del servidor")
            OutlinedTextField(date, { date = it }, label = { Text("Fecha de la semana (AAAA-MM-DD)") }, singleLine = true, enabled = !state.busy)
            val validDate = runCatching { LocalDate.parse(date) }.isSuccess
            Button(onClick = { onLoad(date) }, enabled = validDate && !state.busy) { Text(if (state.busy) "Consultando…" else "Consultar semana") }
            if (pending > 0) Text("Hay $pending marcajes pendientes de sincronizar. Todavía no están incluidos en la consulta del servidor.")
            if (state.message.isNotBlank()) Text(state.message)
            val week = state.week
            if (week != null) {
                val report = personalWeekReport(week, state.acknowledgement)
                Text(report)
                Button(onClick = { onShare(report) }, enabled = !state.busy) { Text("Compartir copia del resumen") }
                val closure = week.optJSONObject("closure")
                var note by remember(closure?.optString("id")) { mutableStateOf("") }
                var reviewed by remember(week) { mutableStateOf(false) }
                var confirmation by remember(week) { mutableStateOf<String?>(null) }
                if (closure?.optString("status") == "closed" && state.acknowledgement == null && state.allowAcknowledgement) {
                    Text("Revisa los tramos y totales antes de responder. Tu respuesta no implica renunciar a derechos ni confirma el pago de salarios. Una respuesta por versión de cierre.")
                    OutlinedTextField(note, { if (it.length <= 500) note = it }, label = { Text("Comentario opcional (${note.length}/500)") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                    Checkbox(checked = reviewed, onCheckedChange = { reviewed = it }, enabled = !state.busy)
                    Text("He revisado los registros de esta versión")
                    Button(onClick = { confirmation = "agreed" }, enabled = reviewed && !state.busy && pending == 0) { Text("Estoy conforme") }
                    Button(onClick = { confirmation = "objected" }, enabled = reviewed && !state.busy) { Text("Reportar diferencia") }
                    Text("Si ya respondiste desde otro dispositivo o sesión, el servidor rechazará una segunda respuesta. La consulta actual no incluye acuses previos ni el detalle de ajustes; RH puede ayudarte a revisarlos.")
                } else if (closure == null || closure.optString("status") != "closed") Text("La semana todavía no tiene un cierre vigente para responder.")
                confirmation?.let { type ->
                    AlertDialog(onDismissRequest = { confirmation = null }, title = { Text("Confirmar respuesta") },
                        text = { Text("Semana ${week.getString("weekStart")}, cierre versión ${closure?.optInt("version")}.\n${if (type == "agreed") "Estoy conforme" else "Reporto una diferencia"}\n$note\nLa respuesta se enviará al servidor y no se puede reemplazar desde la app.") },
                        confirmButton = { TextButton(onClick = { confirmation = null; onAcknowledge(closure!!.getString("id"), type, note) }) { Text("Enviar respuesta") } },
                        dismissButton = { TextButton(onClick = { confirmation = null }) { Text("Volver a revisar") } })
                }
            }
        }
    }
}

fun personalWeekReport(week: JSONObject, acknowledgement: JSONObject?): String = buildString {
    val zone = ZoneId.of(week.getString("timeZone"))
    fun timestamp(value: String) = Instant.parse(value).atZone(zone).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss XXX"))
    appendLine("Semana: ${week.getString("weekStart")} · Zona: $zone")
    val closure = week.optJSONObject("closure")
    appendLine(if (closure == null) "Semana provisional" else "Cierre: ${closure.getString("id")} · Versión ${closure.getInt("version")} · ${if (closure.optString("status") == "closed") "Cerrado" else "Reabierto"}")
    val totals = week.getJSONObject("totals")
    fun hours(key: String): String { val minutes = totals.getInt(key); return "${minutes / 60} h ${minutes % 60} min" }
    appendLine("Trabajo: ${hours("workedMinutes")}\nDescansos: ${hours("breakMinutes")}\nOrdinarias: ${hours("ordinaryMinutes")}\nExtraordinarias: ${hours("overtimeMinutes")}")
    appendLine("Totales informativos sujetos a revisión; no equivalen a una liquidación de nómina.")
    val segments = week.getJSONArray("segments")
    if (segments.length() == 0) appendLine("Sin tramos registrados. Esto no determina una falta injustificada.")
    for (i in 0 until segments.length()) {
        val item = segments.getJSONObject(i)
        val end = if (item.isNull("endAt")) "Sin salida registrada" else timestamp(item.getString("endAt"))
        appendLine("${if (item.getString("kind") == "work") "Trabajo" else "Descanso"}: ${timestamp(item.getString("startAt"))} → $end · ${item.getInt("minutes")} min")
    }
    val alerts = week.getJSONArray("alerts")
    for (i in 0 until alerts.length()) appendLine("Aviso: ${alerts.getJSONObject(i).getString("message")}")
    appendLine("Incidencias abiertas: ${week.getJSONArray("openIncidentIds").length()}")
    if (acknowledgement != null) {
        appendLine("Respuesta confirmada: ${if (acknowledgement.getString("type") == "agreed") "Conforme" else "Diferencia reportada"} · ${timestamp(acknowledgement.getString("at"))}")
        appendLine("Comentario: ${if (acknowledgement.isNull("note")) "Sin comentario" else acknowledgement.getString("note")}")
        appendLine("Acuse: ${acknowledgement.getString("id")} · Referencia: ${acknowledgement.getString("evidenceHash")}")
    }
}
