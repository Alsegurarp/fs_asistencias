package mx.fastsolution.zenit.capture

import mx.fastsolution.zenit.api.Checks

/**
 * Las dos formas de marcar, que se venden por separado: la tarjeta de la
 * persona en el lector fijo de la sede (`card_terminal`) y el teléfono de la
 * persona en la etiqueta de la sede (`phone_tag`). El plan de la empresa dice
 * cuáles tiene; una sede puede admitir menos; cada persona marca de una sola.
 */
object CaptureMethods {
    const val CARD_TERMINAL = "card_terminal"
    const val PHONE_TAG = "phone_tag"
    val ALL = listOf(CARD_TERMINAL, PHONE_TAG)

    /** La forma de una persona: con su tarjeta (`card`) o con su teléfono (`phone`). */
    val PERSON = setOf("card", "phone")

    /** La forma de marcar que corresponde a la de una persona. */
    fun of(personMethod: String) = if (personMethod == "phone") PHONE_TAG else CARD_TERMINAL

    /** Lo que admite una sede: lo suyo dentro de lo del plan. Sin sede, o sin elección de la sede, todo el plan. */
    fun effective(plan: List<String>, site: List<String>?): List<String> = if (site == null) plan else plan.filter { it in site }

    /** Una lista de formas: al menos una, sin repetir y en el orden de [ALL]. */
    fun parse(checks: Checks, field: String, value: Any?, required: Boolean): List<String>? {
        if (value == null) {
            if (required) checks.fail(field, "required", "Es obligatorio.")
            return null
        }
        val items = (value as? List<*>)?.takeIf { list -> list.all { it is String } }?.map { it as String }
        when {
            items == null -> checks.fail(field, "invalid_value", "Debe ser una lista de formas de marcar.")
            items.isEmpty() -> checks.fail(field, "empty", "Hace falta al menos una forma de marcar.")
            items.any { it !in ALL } -> checks.fail(field, "invalid_value", "Valores admitidos: ${ALL.joinToString(", ")}.")
            items.size != items.toSet().size -> checks.fail(field, "duplicate", "Una forma de marcar va una sola vez.")
            else -> return ALL.filter { it in items }
        }
        return null
    }
}
