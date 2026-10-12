package mx.fastsolution.zenit.security

import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class IdentityTokenValidatorTest {
    private val identity = IdentityProperties(
        issuer = "http://localhost:8082/realms/zenit",
        jwksUri = "http://keycloak:8082/realms/zenit/protocol/openid-connect/certs",
        audience = "zenit-api",
    )
    private val validator = identityTokenValidator(identity)

    private fun token(
        issuer: String = identity.issuer,
        audience: List<String>? = listOf("zenit-api", "account"),
        expiresAt: Instant = Instant.now().plusSeconds(300),
    ): Jwt {
        val builder = Jwt.withTokenValue("ficticio")
            .header("alg", "RS256")
            .subject("a3c5e7b9-1d3f-4b5a-9c7e-1b3d5f7a9c1e")
            .issuer(issuer)
            .issuedAt(expiresAt.minusSeconds(300))
            .expiresAt(expiresAt)
        if (audience != null) builder.audience(audience)
        return builder.build()
    }

    @Test
    fun `accepts a current token from the realm with the api audience`() {
        assertFalse(validator.validate(token()).hasErrors())
    }

    @Test
    fun `rejects a token from another issuer`() {
        assertTrue(validator.validate(token(issuer = "http://localhost:8082/realms/master")).hasErrors())
    }

    @Test
    fun `rejects a token without the api audience`() {
        assertTrue(validator.validate(token(audience = listOf("account"))).hasErrors())
        assertTrue(validator.validate(token(audience = null)).hasErrors())
    }

    @Test
    fun `rejects an expired token`() {
        assertTrue(validator.validate(token(expiresAt = Instant.now().minusSeconds(120))).hasErrors())
    }
}
