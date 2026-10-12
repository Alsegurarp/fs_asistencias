package mx.fastsolution.zenit.employee

/**
 * Lector mínimo de CSV: comas, comillas dobles con `""` como comilla, y saltos
 * de línea dentro de un campo entrecomillado. No interpreta el contenido.
 */
object Csv {
    private const val BOM = '﻿'

    /** Devuelve las filas con el número de línea donde empieza cada una. */
    fun parse(text: String): List<Pair<Int, List<String>>> {
        val rows = mutableListOf<Pair<Int, List<String>>>()
        var fields = mutableListOf<String>()
        val field = StringBuilder()
        var quoted = false
        var line = 1
        var startLine = 1
        var i = if (text.startsWith(BOM)) 1 else 0

        fun endRow() {
            fields += field.toString()
            field.setLength(0)
            // Una línea en blanco no es una fila.
            if (fields.size > 1 || fields[0].isNotBlank()) rows += startLine to fields
            fields = mutableListOf()
        }

        while (i < text.length) {
            val c = text[i]
            when {
                quoted && c == '"' && i + 1 < text.length && text[i + 1] == '"' -> {
                    field.append('"')
                    i++
                }
                quoted && c == '"' -> quoted = false
                quoted -> {
                    if (c == '\n') line++
                    field.append(c)
                }
                c == '"' && field.isEmpty() -> quoted = true
                c == ',' -> {
                    fields += field.toString()
                    field.setLength(0)
                }
                c == '\r' -> Unit
                c == '\n' -> {
                    endRow()
                    line++
                    startLine = line
                }
                else -> field.append(c)
            }
            i++
        }
        if (field.isNotEmpty() || fields.isNotEmpty()) endRow()
        return rows
    }
}
