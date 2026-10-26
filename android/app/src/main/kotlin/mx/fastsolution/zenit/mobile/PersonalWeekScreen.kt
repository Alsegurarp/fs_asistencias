package mx.fastsolution.zenit.mobile

import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class PersonalWeekState(
    val week: JSONObject? = null,
    val acknowledgement: JSONObject? = null,
    val busy: Boolean = false,
    val allowAcknowledgement: Boolean = true,
    val message: String = "",
)

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
