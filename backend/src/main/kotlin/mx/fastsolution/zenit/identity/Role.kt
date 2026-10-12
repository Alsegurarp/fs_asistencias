package mx.fastsolution.zenit.identity

/** Roles del producto, con el nombre que viaja en el contrato. */
enum class Role(val wire: String, val ofTenant: Boolean) {
    /** Opera el servicio; no pertenece a ninguna empresa. */
    OPERADOR_SAAS("operador_saas", false),
    ADMIN_EMPRESA("admin_empresa", true),
    RH("rh", true),
    SUPERVISOR("supervisor", true),
    TRABAJADOR("trabajador", true),
    AUDITOR("auditor", true),
    ;

    companion object {
        /** Roles que una empresa puede asignar a su gente. */
        val OF_TENANT: Set<String> = entries.filter { it.ofTenant }.map { it.wire }.toSet()

        fun ofTenant(wire: String): Role? = entries.firstOrNull { it.ofTenant && it.wire == wire }
    }
}
