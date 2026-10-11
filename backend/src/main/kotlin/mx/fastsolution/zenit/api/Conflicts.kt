package mx.fastsolution.zenit.api

import java.sql.SQLException

/** Lee de un error de la base qué regla de unicidad se rompió. */
object Conflicts {
    private const val UNIQUE_VIOLATION = "23505"

    fun uniqueConstraint(e: Throwable): String? {
        val cause = generateSequence(e) { it.cause }.filterIsInstance<SQLException>().firstOrNull() ?: return null
        if (cause.sqlState != UNIQUE_VIOLATION) return null
        return KNOWN.firstOrNull { cause.message?.contains(it) == true }
    }

    const val TENANT_SLUG = "tenant_slug_key"
    const val USER_EMAIL = "tenant_user_email_key"
    const val EMPLOYEE_EXTERNAL_ID = "employee_external_id_key"
    const val CARD_LABEL = "card_label_key"
    const val CARD_FINGERPRINT = "card_fingerprint_key"
    const val IMPORT_IDEMPOTENCY = "employee_import_idempotency_key"
    private val KNOWN = listOf(TENANT_SLUG, USER_EMAIL, EMPLOYEE_EXTERNAL_ID, CARD_LABEL, CARD_FINGERPRINT, IMPORT_IDEMPOTENCY)

    fun externalIdTaken() = Problems.conflict("external_id_taken", "Ya existe una persona con ese identificador externo.")

    fun cardTaken() = Problems.conflict("card_taken", "Ya existe una tarjeta con ese número o con esa huella.")

    /**
     * Un correo pertenece a una sola empresa. La respuesta no dice dónde está
     * ocupado: sólo que no se puede usar.
     */
    fun emailUnavailable() = Problems.conflict("email_unavailable", "Ese correo no se puede usar para una invitación.")

    fun slugTaken() = Problems.conflict("slug_taken", "Ya existe una empresa con ese identificador.")
}
