package mx.fastsolution.zenit

import org.junit.jupiter.api.Tag
import org.springframework.test.context.TestPropertySource
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Cuota de peticiones por persona, de punta a punta y con un límite bajo. Las
 * demás pruebas la abren, porque comparten pocas identidades y hacen muchas
 * llamadas por minuto.
 */
@Tag("integration")
@TestPropertySource(properties = ["zenit.api.person-requests-per-minute=8"])
class QuotaIT : ApiTestBase() {
    private fun users(tenantId: String): Int =
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement("select count(*) from tenant_user where tenant_id = ?").use {
                it.setObject(1, UUID.fromString(tenantId))
                it.executeQuery().use { rows -> if (rows.next()) rows.getInt(1) else 0 }
            }
        }

    @Test
    fun `a person who asks too much in a minute is cut off, without touching anyone else`() {
        val c = company()
        // Otra persona de la misma empresa, creada antes de que la primera agote su cuota.
        val rh = member(c, "rh")
        assertEquals(2, users(c.id))

        // La administradora ya hizo dos peticiones al crear lo anterior; le quedan seis.
        val replies = (1..6).map { call("GET", "/api/v1/tenant", c.adminToken).status }
        assertEquals(List(6) { 200 }, replies)
        val over = call("GET", "/api/v1/tenant", c.adminToken)
        assertProblem(429, "rate_limited", over)
        assertEquals("https://zenit.invalid/problems/rate-limited", over.at("type"))
        assertEquals("no-store", over.header("Cache-Control"))
        // Rechazada antes de llegar a la ruta: una escritura no deja nada, sea válida o no.
        assertProblem(429, "rate_limited", call("POST", "/api/v1/users", c.adminToken, """{"email":"${email("tarde")}","roles":["rh"]}"""))
        assertProblem(429, "rate_limited", call("POST", "/api/v1/users", c.adminToken, "{no es json"))
        assertEquals(2, users(c.id))
        // Cambiar de sesión no la renueva: la cuenta es de la persona, no del token.
        assertProblem(429, "rate_limited", call("GET", "/api/v1/me", token(adminSubject(c), c.adminEmail)))

        // Otra persona de la misma empresa sigue con su propia cuenta.
        assertEquals(200, call("GET", "/api/v1/tenant", rh.token).status)
        // Lo que no pide credencial no se cuenta contra nadie.
        repeat(12) { assertEquals(200, call("GET", "/api/v1/system/status").status) }
        // Una credencial que no sirve se rechaza como siempre, sin gastar la cuota de nadie.
        repeat(12) { assertProblem(401, "unauthorized", call("GET", "/api/v1/tenant", "no-es-un-token")) }
        assertEquals(200, call("GET", "/api/v1/tenant", rh.token).status)
    }

    /** El sujeto con el que la administradora quedó ligada. */
    private fun adminSubject(c: Company): String =
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement("select subject from tenant_user where tenant_id = ? and id = ?").use {
                it.setObject(1, UUID.fromString(c.id))
                it.setObject(2, UUID.fromString(c.adminId))
                it.executeQuery().use { rows ->
                    rows.next()
                    rows.getString(1)
                }
            }
        }
}
