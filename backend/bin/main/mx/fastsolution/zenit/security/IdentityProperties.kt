package mx.fastsolution.zenit.security

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Datos del proveedor de identidad. Ninguno tiene valor por defecto que abra
 * el servicio: sin emisor ni dirección de claves la aplicación no arranca.
 */
@ConfigurationProperties("zenit.identity")
data class IdentityProperties(
    /** Emisor público que deben traer los tokens en `iss`. */
    val issuer: String,
    /** Dirección, por la red interna, donde se leen las claves públicas. */
    val jwksUri: String,
    /** Audiencia que debe venir en `aud`. */
    val audience: String,
)
