package mx.fastsolution.zenit.api

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.util.UUID

/** Junta los errores de validación de un cuerpo y los responde todos a la vez. */
class Checks {
    private val errors = mutableListOf<FieldError>()

    fun fail(field: String, code: String, message: String) {
        errors += FieldError(field, code, message)
    }

    fun text(field: String, value: String?, max: Int, required: Boolean): String? {
        val clean = value?.trim()
        when {
            clean.isNullOrEmpty() -> if (required || value != null) fail(field, "required", "No puede ir vacío.")
            clean.length > max -> fail(field, "too_long", "Admite hasta $max caracteres.")
        }
        return clean
    }

    fun oneOf(field: String, value: String?, allowed: Set<String>, required: Boolean): String? {
        when {
            value == null -> if (required) fail(field, "required", "Es obligatorio.")
            value !in allowed -> fail(field, "invalid_value", "Valores admitidos: ${allowed.joinToString(", ")}.")
        }
        return value
    }

    fun timeZone(field: String, value: String?, required: Boolean): String? {
        when {
            value == null -> if (required) fail(field, "required", "Es obligatorio.")
            value !in ZoneId.getAvailableZoneIds() ->
                fail(field, "invalid_time_zone", "Debe ser una zona IANA, por ejemplo America/Mexico_City.")
        }
        return value
    }

    /** Devuelve el correo normalizado: sin espacios alrededor y en minúsculas. */
    fun email(field: String, value: String?): String? {
        val clean = value?.trim()?.lowercase()
        when {
            clean.isNullOrEmpty() -> fail(field, "required", "Es obligatorio.")
            clean.length > MAX_EMAIL || !EMAIL.matches(clean) -> fail(field, "invalid_email", "No es un correo válido.")
        }
        return clean
    }

    fun date(field: String, value: String?, required: Boolean): LocalDate? {
        if (value == null) {
            if (required) fail(field, "required", "Es obligatorio.")
            return null
        }
        return try {
            LocalDate.parse(value)
        } catch (e: DateTimeParseException) {
            fail(field, "invalid_date", "Debe ser una fecha AAAA-MM-DD.")
            null
        }
    }

    fun time(field: String, value: String?): LocalTime? {
        if (value == null || !TIME.matches(value)) {
            fail(field, "invalid_time", "Debe ser una hora HH:MM.")
            return null
        }
        return LocalTime.parse(value)
    }

    fun uuid(field: String, value: String?, required: Boolean): UUID? {
        if (value == null) {
            if (required) fail(field, "required", "Es obligatorio.")
            return null
        }
        return try {
            UUID.fromString(value)
        } catch (e: IllegalArgumentException) {
            fail(field, "invalid_identifier", "No es un identificador válido.")
            null
        }
    }

    fun whole(field: String, value: Int?, min: Int, max: Int, required: Boolean): Int? {
        when {
            value == null -> if (required) fail(field, "required", "Es obligatorio.")
            value < min || value > max -> fail(field, "out_of_range", "Debe estar entre $min y $max.")
        }
        return value
    }

    fun decimal(field: String, value: Double?, min: Double, max: Double, required: Boolean): Double? {
        when {
            value == null -> if (required) fail(field, "required", "Es obligatorio.")
            value.isNaN() || value < min || value > max ->
                fail(field, "out_of_range", "Debe estar entre ${min.toInt()} y ${max.toInt()}.")
        }
        return value
    }

    val failed: Boolean get() = errors.isNotEmpty()

    fun done() {
        if (errors.isNotEmpty()) throw Problems.validation(errors.toList())
    }

    companion object {
        private const val MAX_EMAIL = 254
        private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
        val SLUG = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")
        private val TIME = Regex("^([01][0-9]|2[0-3]):[0-5][0-9]$")
        val WEEK_DAYS = setOf("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
        val BREAK_POLICIES = setOf("not_considered", "marked")
    }
}
