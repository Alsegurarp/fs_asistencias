package mx.fastsolution.zenit.persistence

import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile

/**
 * Al atender peticiones el backend no cambia el esquema: comprueba que esté al
 * día y, si no lo está o no puede conectarse, no arranca. Aplicarlo le toca al
 * perfil migrate, que usa otro rol.
 */
@Configuration(proxyBeanMethods = false)
class SchemaConfig {
    @Bean
    @Profile("!migrate")
    fun validateSchemaOnly() = FlywayMigrationStrategy { it.validate() }
}
