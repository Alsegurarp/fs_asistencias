package mx.fastsolution.zenit.api

/**
 * Búsqueda por texto de las listas: por fragmento y sin distinguir mayúsculas
 * ni acentos, con la función `search_key` de la base. Se aplica en el
 * servidor, antes de paginar.
 */
object TextSearch {
    const val MAX_LENGTH = 100

    /** Patrón `LIKE` ya escapado, o nulo si no se buscó nada. Un `%` o un `_` del texto se buscan tal cual. */
    fun pattern(checks: Checks, raw: String?): String? {
        val text = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        if (text.length > MAX_LENGTH) {
            checks.fail("q", "too_long", "Admite hasta $MAX_LENGTH caracteres.")
            return null
        }
        return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    }

    /** Condición: alguna de las expresiones contiene el patrón. Lleva el patrón una vez por expresión. */
    fun clause(vararg expressions: String): String =
        expressions.joinToString(" or ", " and (", ")") { "search_key($it) like search_key(?) escape '\\'" }

    fun binds(pattern: String, expressions: Int): List<String> = List(expressions) { pattern }
}
