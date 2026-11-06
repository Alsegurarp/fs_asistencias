package mx.fastsolution.zenit.mobile.capture

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.flow

/**
 * La política de comida que vale en un instante. La sesión trae la de hoy y,
 * si hay un cambio programado, cuándo entra: desde ese instante el teléfono
 * usa la nueva aunque no tenga red, igual que el servidor con la marca.
 */
object BreakPolicySchedule {
    val POLICIES = setOf("marked", "not_considered")

    fun updates(effectiveAt: Instant?) = flow {
        val now = Instant.now()
        emit(Unit)
        if (effectiveAt != null && now.isBefore(effectiveAt)) {
            do {
                delay(Duration.between(Instant.now(), effectiveAt).toMillis().coerceAtLeast(0) + 1)
            } while (Instant.now().isBefore(effectiveAt))
            emit(Unit)
        }
    }

    fun at(current: String, upcoming: String?, effectiveAt: Instant?, instant: Instant): String =
        if (upcoming != null && effectiveAt != null && !instant.isBefore(effectiveAt)) upcoming else current

    /** El aviso para la persona mientras el cambio no entra; nulo si no hay cambio o ya entró. */
    fun notice(upcoming: String?, effectiveOn: String?, effectiveAt: Instant?, now: Instant): String? {
        if (upcoming == null || effectiveOn == null || effectiveAt == null || !now.isBefore(effectiveAt)) return null
        val day = LocalDate.parse(effectiveOn)
        val weekday = day.dayOfWeek.getDisplayName(TextStyle.FULL, SPANISH)
        val month = day.month.getDisplayName(TextStyle.FULL, SPANISH)
        val date = "$weekday ${day.dayOfMonth} de $month de ${day.year}"
        return if (upcoming == "marked") "Aviso: desde el $date se marcarán el inicio y el fin de la comida."
        else "Aviso: desde el $date ya no se marcará la comida, sólo entrada y salida."
    }

    private val SPANISH: Locale = Locale.forLanguageTag("es-MX")
}
