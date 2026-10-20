package mx.fastsolution.zenit.security

import jakarta.servlet.http.HttpServletRequest
import mx.fastsolution.zenit.device.DeviceAuthentication
import mx.fastsolution.zenit.device.DeviceAuthenticator
import mx.fastsolution.zenit.device.DeviceKeys
import mx.fastsolution.zenit.identity.PersonAuthenticationConverter
import mx.fastsolution.zenit.identity.Role
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.AuthenticationManagerResolver
import org.springframework.security.authentication.ProviderManager
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
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationProvider
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter
import org.springframework.security.web.SecurityFilterChain

/**
 * Niega todo por defecto. Cada ruta nueva se abre aquí de forma explícita;
 * una ruta que no esté en la lista responde 401 sin credencial y 403 con ella.
 */
@Configuration(proxyBeanMethods = false)
// El paso de migraciones no abre puertos y no necesita nada de esto.
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableWebSecurity
@EnableConfigurationProperties(IdentityProperties::class, ApiProperties::class)
class SecurityConfig {
    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        problems: SecurityProblemWriter,
        people: PersonAuthenticationConverter,
        decoder: JwtDecoder,
        deviceAuthenticator: DeviceAuthenticator,
        api: ApiProperties,
    ): SecurityFilterChain {
        val operator = Role.OPERADOR_SAAS.wire
        val admin = Role.ADMIN_EMPRESA.wire
        val rh = Role.RH.wire
        val supervisor = Role.SUPERVISOR.wire
        val auditor = Role.AUDITOR.wire
        val worker = Role.TRABAJADOR.wire
        val device = DeviceAuthentication.ROLE
        // Dos credenciales: las personas traen un token del proveedor de identidad y
        // los dispositivos una aserción firmada con su propia clave. La ruta decide
        // con cuál se verifica; una credencial en la ruta equivocada no pasa.
        val users = ProviderManager(JwtAuthenticationProvider(decoder).apply { setJwtAuthenticationConverter(people) })
        val devices = AuthenticationManager { deviceAuthenticator.authenticate(it) }
        val credentials = AuthenticationManagerResolver<HttpServletRequest> {
            when {
                it.method == "POST" && it.requestURI in DEVICE_ROUTES -> devices
                // Lo que es del propio trabajador se puede pedir con su cuenta o con su teléfono.
                isWorkerRoute(it) && DeviceKeys.isDeviceToken(it.getHeader("Authorization")) -> devices
                else -> users
            }
        }
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
                it.requestMatchers(
                    HttpMethod.POST,
                    "/api/v1/tenants/{tenantId}/suspension",
                    "/api/v1/tenants/{tenantId}/reactivation",
                    "/api/v1/tenants/{tenantId}/administrators/unlink",
                )
                    .hasRole(operator)
                it.requestMatchers(HttpMethod.GET, "/api/v1/tenant").hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.PATCH, "/api/v1/tenant").hasRole(admin)
                it.requestMatchers(HttpMethod.GET, "/api/v1/users", "/api/v1/users/{userId}").hasRole(admin)
                it.requestMatchers(HttpMethod.POST, "/api/v1/users").hasRole(admin)
                it.requestMatchers(HttpMethod.PATCH, "/api/v1/users/{userId}").hasRole(admin)
                it.requestMatchers(HttpMethod.POST, "/api/v1/users/{userId}/unlink", "/api/v1/users/{userId}/password-change").hasRole(admin)
                it.requestMatchers(HttpMethod.GET, "/api/v1/audit-log").hasAnyRole(admin, auditor)
                // Sedes y horarios.
                it.requestMatchers(HttpMethod.GET, "/api/v1/sites", "/api/v1/sites/{siteId}").hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.POST, "/api/v1/sites").hasRole(admin)
                it.requestMatchers(HttpMethod.PATCH, "/api/v1/sites/{siteId}").hasRole(admin)
                it.requestMatchers(HttpMethod.GET, "/api/v1/schedules", "/api/v1/schedules/{scheduleId}")
                    .hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.POST, "/api/v1/schedules").hasAnyRole(admin, rh)
                // Padrón e importación.
                it.requestMatchers(HttpMethod.GET, "/api/v1/employees", "/api/v1/employees/{employeeId}")
                    .hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.POST, "/api/v1/employees").hasAnyRole(admin, rh)
                it.requestMatchers(HttpMethod.PATCH, "/api/v1/employees/{employeeId}").hasAnyRole(admin, rh)
                it.requestMatchers(HttpMethod.POST, "/api/v1/employees/{employeeId}/schedule-assignments").hasAnyRole(admin, rh)
                it.requestMatchers(HttpMethod.POST, "/api/v1/imports/csv").hasAnyRole(admin, rh)
                it.requestMatchers(HttpMethod.GET, "/api/v1/imports/{importId}").hasAnyRole(admin, rh)
                // Tarjetas.
                it.requestMatchers(HttpMethod.GET, "/api/v1/cards").hasAnyRole(admin, rh, auditor)
                it.requestMatchers(HttpMethod.POST, "/api/v1/cards").hasAnyRole(admin, rh)
                it.requestMatchers(HttpMethod.POST, "/api/v1/cards/{cardId}/assignments", "/api/v1/cards/{cardId}/revocation")
                    .hasAnyRole(admin, rh)
                // Dispositivos y captura.
                it.requestMatchers(HttpMethod.POST, "/api/v1/device-enrollments").hasAnyRole(admin, rh)
                // Sin credencial: la autoriza el código de un solo uso.
                it.requestMatchers(HttpMethod.POST, "/api/v1/device-activations").permitAll()
                it.requestMatchers(HttpMethod.GET, "/api/v1/devices").hasAnyRole(admin, rh, auditor)
                it.requestMatchers(HttpMethod.POST, "/api/v1/devices/{deviceId}/revocation").hasAnyRole(admin, rh)
                it.requestMatchers(HttpMethod.POST, *DEVICE_ROUTES.toTypedArray()).hasRole(device)
                it.requestMatchers(HttpMethod.GET, "/api/v1/attendance-events").hasAnyRole(admin, rh, supervisor, auditor)
                // Jornada, incidencias y cierre.
                it.requestMatchers(HttpMethod.GET, "/api/v1/employees/{employeeId}/attendance").hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.GET, "/api/v1/me/attendance").hasAnyRole(worker, device)
                it.requestMatchers(HttpMethod.GET, "/api/v1/incidents", "/api/v1/incidents/{incidentId}")
                    .hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.PATCH, "/api/v1/incidents/{incidentId}").hasAnyRole(admin, rh, supervisor)
                it.requestMatchers(HttpMethod.GET, "/api/v1/week-closures").hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.POST, "/api/v1/week-closures").hasAnyRole(admin, rh)
                it.requestMatchers(HttpMethod.GET, "/api/v1/week-closures/{closureId}").hasAnyRole(admin, rh, supervisor, auditor, worker)
                it.requestMatchers(HttpMethod.POST, "/api/v1/week-closures/{closureId}/reopen").hasRole(admin)
                it.requestMatchers(HttpMethod.POST, "/api/v1/week-closures/{closureId}/acknowledgements").hasAnyRole(worker, device)
                it.requestMatchers(HttpMethod.POST, "/api/v1/week-closure-runs").hasAnyRole(admin, rh)
                it.requestMatchers(HttpMethod.GET, "/api/v1/week-closure-runs", "/api/v1/week-closure-runs/{runId}", "/api/v1/week-closure-runs/{runId}/blocked")
                    .hasAnyRole(admin, rh, supervisor, auditor)
                it.requestMatchers(HttpMethod.GET, "/api/v1/rule-sets").hasAnyRole(admin, rh, supervisor, auditor)
                // Exportes y fuentes del padrón.
                it.requestMatchers(HttpMethod.POST, "/api/v1/exports").hasAnyRole(admin, rh, auditor)
                it.requestMatchers(HttpMethod.GET, "/api/v1/exports/{exportId}", "/api/v1/exports/{exportId}/download", "/api/v1/exports/{exportId}/manifest")
                    .hasAnyRole(admin, rh, auditor)
                it.requestMatchers(HttpMethod.GET, "/api/v1/integrations/checkpoints").hasAnyRole(admin, rh)
                it.anyRequest().denyAll()
            }
            .oauth2ResourceServer {
                // El token dice quién es; la empresa y los roles salen de la base.
                it.authenticationManagerResolver(credentials)
                it.authenticationEntryPoint(problems)
                it.accessDeniedHandler(problems)
            }
            // La cuota por persona se cuenta cuando ya se sabe quién llama.
            .addFilterAfter(PersonQuotaFilter(api, problems), BearerTokenAuthenticationFilter::class.java)
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

/** Rutas que sólo llama un dispositivo, con su propia credencial. */
private val DEVICE_ROUTES = setOf("/api/v1/device-sessions", "/api/v1/attendance-events", "/api/v1/attendance-events/batch")

private val ACKNOWLEDGEMENT = Regex("^/api/v1/week-closures/[^/]+/acknowledgements$")

/** Rutas del propio trabajador, que admiten su cuenta o su teléfono personal. */
private fun isWorkerRoute(request: HttpServletRequest): Boolean =
    (request.method == "GET" && request.requestURI == "/api/v1/me/attendance") ||
        (request.method == "POST" && ACKNOWLEDGEMENT.matches(request.requestURI))
