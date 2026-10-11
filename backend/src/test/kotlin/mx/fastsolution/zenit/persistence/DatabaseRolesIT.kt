package mx.fastsolution.zenit.persistence

import org.flywaydb.core.Flyway
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.TestInstance
import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

/**
 * Comprueba contra PostgreSQL real que los roles de la base están separados y
 * que el esquema impide mezclar empresas. Se corre con
 * `docker compose --profile test run --rm backend-it`.
 */
@Tag("integration")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DatabaseRolesIT {
    private val url = System.getenv("IT_DB_URL") ?: error("Falta IT_DB_URL")
    private val identityUrl = System.getenv("IT_IDENTITY_DB_URL") ?: error("Falta IT_IDENTITY_DB_URL")
    private val migratorPassword = secret("db_migrator_password")
    private val appPassword = secret("db_app_password")

    private fun secret(name: String): String = Files.readString(Path.of("/run/secrets", name)).trim()

    private fun asApp(): Connection = DriverManager.getConnection(url, "zenit_app", appPassword)

    private fun denied(block: () -> Unit): String = assertFailsWith<SQLException> { block() }.sqlState

    @BeforeAll
    fun migrate() {
        Flyway.configure()
            .dataSource(url, "zenit_migrator", migratorPassword)
            .locations("classpath:db/migration")
            .load()
            .migrate()
    }

    private fun Connection.newTenant(): UUID {
        val id = UUID.randomUUID()
        prepareStatement(
            "INSERT INTO tenant (id, slug, name, status, time_zone, week_starts_on, break_policy) " +
                "VALUES (?, ?, ?, 'active', 'America/Mexico_City', 'monday', 'not_considered')",
        ).use {
            it.setObject(1, id)
            it.setString(2, "empresa-$id")
            it.setString(3, "Empresa de prueba")
            it.executeUpdate()
        }
        return id
    }

    private fun Connection.newUser(tenant: UUID, email: String = "persona-${UUID.randomUUID()}@zenit.invalid"): UUID {
        val id = UUID.randomUUID()
        prepareStatement("INSERT INTO tenant_user (tenant_id, id, email, status) VALUES (?, ?, ?, 'invited')").use {
            it.setObject(1, tenant)
            it.setObject(2, id)
            it.setString(3, email)
            it.executeUpdate()
        }
        return id
    }

    private fun Connection.grant(tenant: UUID, user: UUID, role: String = "rh") {
        prepareStatement("INSERT INTO tenant_user_role (tenant_id, user_id, role, granted_by) VALUES (?, ?, ?, 'prueba')").use {
            it.setObject(1, tenant)
            it.setObject(2, user)
            it.setString(3, role)
            it.executeUpdate()
        }
    }

    @Test
    fun `the application role is neither superuser nor owner`() {
        asApp().use { db ->
            db.createStatement().use { st ->
                st.executeQuery("SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = 'zenit_app'").use {
                    it.next()
                    assertFalse(it.getBoolean(1))
                    assertFalse(it.getBoolean(2))
                    assertFalse(it.getBoolean(3))
                }
                st.executeQuery("SELECT rolsuper FROM pg_roles WHERE rolname = 'zenit_migrator'").use {
                    it.next()
                    assertFalse(it.getBoolean(1))
                }
                st.executeQuery("SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'").use {
                    it.next()
                    assertEquals("zenit_migrator", it.getString(1))
                    assertFalse(it.next())
                }
            }
        }
    }

    @Test
    fun `the application role cannot change the schema`() {
        asApp().use { db ->
            assertEquals("42501", denied { db.createStatement().use { it.execute("CREATE TABLE intruso (id int)") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("ALTER TABLE tenant ADD COLUMN x int") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("DROP TABLE audit_log") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("TRUNCATE tenant_user_role") } })
        }
    }

    @Test
    fun `the application role only reaches what a migration opened`() {
        asApp().use { db ->
            // El historial de migraciones se lee, pero no se reescribe.
            db.createStatement().use { it.execute("SELECT 1 FROM flyway_schema_history") }
            assertEquals("42501", denied { db.createStatement().use { it.execute("DELETE FROM flyway_schema_history") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("UPDATE flyway_schema_history SET success = true") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("DELETE FROM tenant") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("DELETE FROM tenant_user") } })
        }
    }

    @Test
    fun `the application role can add evidence but not correct or delete it`() {
        asApp().use { db ->
            val tenant = db.newTenant()
            db.prepareStatement(
                "INSERT INTO audit_log (id, tenant_id, actor_type, action, target_type, correlation_id) " +
                    "VALUES (?, ?, 'system', 'prueba', 'prueba', ?)",
            ).use {
                it.setObject(1, UUID.randomUUID())
                it.setObject(2, tenant)
                it.setObject(3, UUID.randomUUID())
                assertEquals(1, it.executeUpdate())
            }
            assertEquals("42501", denied { db.createStatement().use { it.execute("UPDATE audit_log SET action = 'otra'") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("DELETE FROM audit_log") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("UPDATE attendance_event SET device_id = 'x'") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("DELETE FROM attendance_event") } })
        }
    }

    @Test
    fun `a role cannot be granted across companies`() {
        asApp().use { db ->
            val one = db.newTenant()
            val other = db.newTenant()
            val userOfOne = db.newUser(one)

            db.grant(one, userOfOne)
            assertEquals("23503", denied { db.grant(other, userOfOne) })
        }
    }

    @Test
    fun `an email belongs to one company only`() {
        asApp().use { db ->
            val one = db.newTenant()
            val other = db.newTenant()
            val email = "repetido-${UUID.randomUUID()}@zenit.invalid"

            db.newUser(one, email)
            assertEquals("23505", denied { db.newUser(other, email) })
        }
    }

    @Test
    fun `a person cannot be active without a linked identity`() {
        asApp().use { db ->
            val tenant = db.newTenant()
            val user = db.newUser(tenant)

            assertEquals(
                "23514",
                denied {
                    db.prepareStatement("UPDATE tenant_user SET status = 'active' WHERE tenant_id = ? AND id = ?").use {
                        it.setObject(1, tenant)
                        it.setObject(2, user)
                        it.executeUpdate()
                    }
                },
            )
            assertEquals("23514", denied { db.newUser(tenant, "Mayusculas@zenit.invalid") })
        }
    }

    @Test
    fun `the directory is never deleted, schedules and import results are never rewritten`() {
        asApp().use { db ->
            for (table in listOf("site", "schedule", "schedule_day", "employee", "schedule_assignment", "card", "card_assignment", "employee_import")) {
                assertEquals("42501", denied { db.createStatement().use { it.execute("DELETE FROM $table") } }, table)
            }
            assertEquals("42501", denied { db.createStatement().use { it.execute("UPDATE schedule SET name = 'otro'") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("UPDATE schedule_day SET break_minutes = 0") } })
            assertEquals("42501", denied { db.createStatement().use { it.execute("UPDATE employee_import SET status = 'applied'") } })
        }
    }

    @Test
    fun `a directory record cannot point at another company's data`() {
        asApp().use { db ->
            val one = db.newTenant()
            val other = db.newTenant()
            val siteOfOne = UUID.randomUUID()
            db.prepareStatement(
                "INSERT INTO site (tenant_id, id, name, time_zone, latitude, longitude, radius_m, status) " +
                    "VALUES (?, ?, 'Sede', 'America/Mexico_City', 19.4, -99.1, 80, 'active')",
            ).use {
                it.setObject(1, one)
                it.setObject(2, siteOfOne)
                it.executeUpdate()
            }
            fun employee(tenant: UUID, site: UUID?): UUID {
                val id = UUID.randomUUID()
                db.prepareStatement(
                    "INSERT INTO employee (tenant_id, id, external_id, display_name, status, site_id, employment_start, source) " +
                        "VALUES (?, ?, ?, 'Persona', 'active', ?, DATE '2026-01-05', 'manual')",
                ).use {
                    it.setObject(1, tenant)
                    it.setObject(2, id)
                    it.setString(3, "E-$id")
                    it.setObject(4, site)
                    it.executeUpdate()
                }
                return id
            }
            fun card(tenant: UUID): UUID {
                val id = UUID.randomUUID()
                db.prepareStatement("INSERT INTO card (tenant_id, id, label, fingerprint, status) VALUES (?, ?, ?, ?, 'inventory')").use {
                    it.setObject(1, tenant)
                    it.setObject(2, id)
                    it.setString(3, "ZN-$id")
                    it.setString(4, "huella-$id")
                    it.executeUpdate()
                }
                return id
            }
            fun assign(tenant: UUID, card: UUID, employee: UUID) {
                db.prepareStatement("INSERT INTO card_assignment (tenant_id, id, card_id, employee_id) VALUES (?, ?, ?, ?)").use {
                    it.setObject(1, tenant)
                    it.setObject(2, UUID.randomUUID())
                    it.setObject(3, card)
                    it.setObject(4, employee)
                    it.executeUpdate()
                }
            }

            val personOfOne = employee(one, siteOfOne)
            assertEquals("23503", denied { employee(other, siteOfOne) })
            val cardOfOne = card(one)
            val cardOfOther = card(other)
            assertEquals("23503", denied { assign(one, cardOfOther, personOfOne) })
            assertEquals("23503", denied { assign(other, cardOfOther, personOfOne) })

            // Una asignación abierta por tarjeta y una por persona.
            assign(one, cardOfOne, personOfOne)
            assertEquals("23505", denied { assign(one, card(one), personOfOne) })
            assertEquals("23505", denied { assign(one, cardOfOne, employee(one, null)) })
        }
    }

    // Las contraseñas son correctas: el rechazo es por permiso (42501), no por
    // credencial (28P01).
    @Test
    fun `the product and the identity roles cannot enter each other's database`() {
        assertEquals("42501", denied { DriverManager.getConnection(identityUrl, "zenit_app", appPassword).close() })
        assertEquals("42501", denied { DriverManager.getConnection(identityUrl, "zenit_migrator", migratorPassword).close() })
        assertEquals("42501", denied { DriverManager.getConnection(url, "keycloak_app", secret("keycloak_db_password")).close() })
    }
}
