package mx.fastsolution.zenit.identity

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration

/**
 * Quiénes operan el servicio: dan de alta cada empresa y nombran a su primer
 * administrador. Es una lista corta de correos que llega como secreto, uno por
 * línea. Vacía, nadie opera: no hay valor por defecto que abra la puerta.
 */
@ConfigurationProperties("zenit.operators")
class OperatorProperties(emails: String?) {
    private val normalized: Set<String> =
        (emails ?: "").split(',', ';', ' ', '\t', '\r', '\n').map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet()

    val count: Int get() = normalized.size

    fun isOperator(email: String): Boolean = email.trim().lowercase() in normalized
}

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(OperatorProperties::class)
class IdentityConfig
