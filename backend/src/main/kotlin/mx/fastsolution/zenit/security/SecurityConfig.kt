package mx.fastsolution.zenit.security

import mx.fastsolution.zenit.identity.PersonAuthenticationConverter
import mx.fastsolution.zenit.identity.Role
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.web.SecurityFilterChain

/**
 * Niega todo por defecto. Cada ruta nueva se abre aquí de forma explícita;
 * una ruta que no esté en la lista responde 401 sin credencial y 403 con ella.
 */
@Configuration(proxyBeanMethods = false)
// El paso de migraciones no abre puertos y no necesita nada de esto.
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableWebSecurity
@EnableConfigurationProperties(IdentityProperties::class)
class SecurityConfig {
    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        problems: SecurityProblemWriter,
        people: PersonAuthenticationConverter,
    ): SecurityFilterChain {
        val operator = Role.OPERADOR_SAAS.wire
        val admin = Role.ADMIN_EMPRESA.wire
        val rh = Role.RH.wire
        val supervisor = Role.SUPERVISOR.wire
        val auditor = Role.AUDITOR.wire
        http
            // API sin cookies ni sesión: la credencial viaja en cada petición.
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            // Cada línea repite los roles que el contrato declara en `x-roles`.
            .authorizeHttpRequests {
                it.requestMatchers(HttpMethod.GET, "/api/v1/system/status").permitAll()
                it.requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**").permitAll()
                it.requestMatchers(HttpMethod.GET, "/api/v1/me").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/v1/tenants").hasRole(operator)
                it.requestMatchers(HttpMethod.POST, "/api/v1/tenants").hasRole(operator)
                it.requestMatchers(HttpMethod.GET, "/api/v1/tenant").hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.PATCH, "/api/v1/tenant").hasRole(admin)
                it.requestMatchers(HttpMethod.GET, "/api/v1/users", "/api/v1/users/{userId}").hasRole(admin)
                it.requestMatchers(HttpMethod.POST, "/api/v1/users").hasRole(admin)
                it.requestMatchers(HttpMethod.PATCH, "/api/v1/users/{userId}").hasRole(admin)
                it.requestMatchers(HttpMethod.GET, "/api/v1/audit-log").hasAnyRole(admin, auditor)
                it.anyRequest().denyAll()
            }
            .oauth2ResourceServer {
                // El token dice quién es; la empresa y los roles salen de la base.
                it.jwt { jwt -> jwt.jwtAuthenticationConverter(people) }
                it.authenticationEntryPoint(problems)
                it.accessDeniedHandler(problems)
            }
            .exceptionHandling {
                it.authenticationEntryPoint(problems)
                it.accessDeniedHandler(problems)
            }
        return http.build()
    }

    /**
     * Las claves se leen por la red interna y el emisor se compara con el
     * público: así el backend arranca aunque la identidad todavía no responda.
     */
    @Bean
    fun jwtDecoder(identity: IdentityProperties): JwtDecoder {
        val decoder = NimbusJwtDecoder.withJwkSetUri(identity.jwksUri).build()
        decoder.setJwtValidator(identityTokenValidator(identity))
        return decoder
    }
}

/** Vigencia, emisor, audiencia y sujeto: los cuatro deben cumplirse. */
fun identityTokenValidator(identity: IdentityProperties): OAuth2TokenValidator<Jwt> =
    DelegatingOAuth2TokenValidator(
        JwtValidators.createDefaultWithIssuer(identity.issuer),
        claimRule("audiencia") { it.audience?.contains(identity.audience) == true },
        claimRule("sujeto") { !it.subject.isNullOrBlank() },
    )

private fun claimRule(name: String, rule: (Jwt) -> Boolean) = OAuth2TokenValidator<Jwt> { jwt ->
    if (rule(jwt)) {
        OAuth2TokenValidatorResult.success()
    } else {
        OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "El token no cumple: $name", null))
    }
}
