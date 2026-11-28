package mx.fastsolution.zenit

import com.nimbusds.jwt.SignedJWT
import org.junit.jupiter.api.Tag
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito
import org.springframework.test.context.TestPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean
import mx.fastsolution.zenit.identity.AuditIdentityProvisioning
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Usuarios y bitácora para el portal: búsqueda, filtros y conteos en el
 * servidor, el permiso de expediente en la lista y el total acotado.
 */
@Tag("integration")
@TestPropertySource(properties = ["ZENIT_AUDIT_PORTAL_URL=https://auditoria.zenit.invalid"])
class AccessAndAuditIT : WorkdayTestBase() {
    @MockitoBean
    private lateinit var auditIdentity: AuditIdentityProvisioning

    @Test
    fun `audit link requires the invited verified identity and can only be used once`() {
        val tenant = company()
        val other = company()
        val email = email("auditor")
        val auditRequest = """{"email":"$email","roles":["auditor"],"externalAuditor":true}"""
        fun inviteAuditor(adminToken: String = tenant.adminToken) = call("POST", "/api/v1/users", adminToken, auditRequest)
        assertEquals(422, call("POST", "/api/v1/users", tenant.adminToken,
            """{"email":"$email","roles":["auditor","rh"],"externalAuditor":true}""").status)
        val invite = inviteAuditor()
        assertEquals(201, invite.status)
        assertEquals(true, invite.at<Boolean>("externalAuditor"))
        val id = invite.at<String>("id")
        val retry = inviteAuditor()
        assertEquals(201, retry.status)
        assertEquals(id, retry.at<String>("id"))
        val subject = subject()
        val portal = token(subject, email, authorizedParty = "zenit-audit-portal")
        assertEquals("none", call("GET", "/api/v1/me", portal).at<String>("access"))
        val path = "/api/v1/users/$id/audit-invitation"
        assertEquals(404, call("POST", path, other.adminToken).status)
        val unavailableMail = call("POST", "$path?send=true", tenant.adminToken)
        assertEquals(503, unavailableMail.status)
        assertEquals("audit_mail_unconfigured", unavailableMail.at<String>("code"))
        assertTrue("detail" !in unavailableMail.whole())
        // Una cuenta nueva recibe sólo el correo de activación, que termina en el enlace: no necesita Brevo.
        Mockito.`when`(auditIdentity.prepare(anyString(), anyString(), anyString())).thenReturn(true)
        val activationOnly = call("POST", "$path?send=true", tenant.adminToken)
        assertEquals(200, activationOnly.status, activationOnly.toString())
        assertEquals(true, activationOnly.at<Boolean>("sent"))
        val prepared = Mockito.mockingDetails(auditIdentity).invocations.last().arguments
        assertEquals(listOf(email, activationOnly.at<String>("url")), listOf(prepared[0], prepared[2]))
        Mockito.reset(auditIdentity)
        fun revoke() = call("PATCH", "/api/v1/users/$id", tenant.adminToken, """{"disabled":true}""")
        assertEquals(200, revoke().status)
        assertEquals(409, inviteAuditor(other.adminToken).status)
        val afterFailedDelivery = inviteAuditor()
        assertEquals(201, afterFailedDelivery.status, afterFailedDelivery.toString())
        assertEquals(id, afterFailedDelivery.at<String>("id"))
        assertEquals("invited", afterFailedDelivery.at<String>("status"))
        val first = call("POST", path, tenant.adminToken)
        assertEquals(200, first.status, first.toString())
        val second = call("POST", path, tenant.adminToken)
        assertEquals(200, second.status, second.toString())
        val code = second.at<String>("url").substringAfter("#invitacion=")
        fun accept(access: String, link: String = code) =
            call("POST", "/api/v1/audit-invitations/accept", access, """{"token":"$link"}""")
        assertEquals("none", call("GET", "/api/v1/me", portal).at<String>("access"))
        assertEquals(404, accept(portal, first.at<String>("url").substringAfter("#invitacion=")).status)
        assertEquals(404, accept(token(subject(), email("impostor"), authorizedParty = "zenit-audit-portal")).status)
        assertEquals(403, accept(token(subject, email, verified = false, authorizedParty = "zenit-audit-portal")).status)
        assertEquals(200, accept(portal).status)
        assertEquals(404, accept(portal).status)
        assertEquals(409, inviteAuditor().status)
        assertEquals(tenant.id, call("GET", "/api/v1/me", portal).at<String>("tenant.id"))
        assertEquals(true, call("GET", "/api/v1/me/dossier-permission", portal).at<Boolean>("enabled"))
        assertEquals(409, call("PUT", "/api/v1/users/$id/dossier-permission", tenant.adminToken, """{"enabled":false}""").status)
        assertEquals(422, call("PATCH", "/api/v1/users/$id", tenant.adminToken, """{"roles":["auditor","rh"]}""").status)
        assertEquals(200, revoke().status)
        assertEquals("none", call("GET", "/api/v1/me", portal).at<String>("access"))
        assertEquals(403, call("GET", "/api/v1/me/dossier-permission", portal).status)
        assertEquals(false, call("GET", "/api/v1/users/$id", tenant.adminToken).at<Boolean>("dossierPermission"))
        val reinvited = inviteAuditor()
        assertEquals(201, reinvited.status, reinvited.toString())
        assertEquals(id, reinvited.at<String>("id"))
        assertEquals("invited", reinvited.at<String>("status"))
        assertEquals("none", call("GET", "/api/v1/me", portal).at<String>("access"))
        assertEquals(404, accept(portal).status)
        val newInvitation = call("POST", path, tenant.adminToken)
        assertEquals(200, newInvitation.status, newInvitation.toString())
        assertEquals(200, accept(portal, newInvitation.at<String>("url").substringAfter("#invitacion=")).status)
        assertEquals(true, call("GET", "/api/v1/me/dossier-permission", portal).at<Boolean>("enabled"))
    }

    @Test
    fun `audit portal tokens only read authorized company attendance`() {
        val company = company()
        val other = company()
        val auditor = member(company, "auditor", "rh")
        val subject = SignedJWT.parse(auditor.token).jwtClaimsSet.subject
        val portal = token(subject, auditor.email, authorizedParty = "zenit-audit-portal")
        val me = call("GET", "/api/v1/me", portal)
        assertEquals(200, me.status)
        assertEquals(listOf("auditor"), me.at<List<String>>("roles"))
        assertEquals(company.id, me.at<String>("tenant.id"))
        val own = staffed(company, newSite(company))
        val foreign = staffed(other, newSite(other))
        val ownWeek = call("GET", "/api/v1/employees/${own.employeeId}/attendance?week=$today", portal)
        assertEquals(200, ownWeek.status, ownWeek.toString())
        val foreignWeek = call("GET", "/api/v1/employees/${foreign.employeeId}/attendance?week=$today", portal)
        assertEquals(404, foreignWeek.status, foreignWeek.toString())
        assertEquals(401, call("POST", "/api/v1/exports", portal, "{}").status)
        assertEquals(401, call("GET", "/api/v1/audit-log", portal).status)
        assertEquals(200, call("PATCH", "/api/v1/users/${auditor.id}", company.adminToken, """{"disabled":true}""").status)
        assertEquals("none", call("GET", "/api/v1/me", portal).at<String>("access"))
    }

    private fun ids(reply: Reply): List<String> {
        assertEquals(200, reply.status, reply.toString())
        return reply.list("items[*].id")
    }

    private fun users(c: Company, query: String = "") = call("GET", "/api/v1/users$query", c.adminToken)

    private fun errorCode(reply: Reply): String {
        assertProblem(422, "validation", reply)
        return reply.at("errors[0].code")
    }

    @Test
    fun `people with access are searched, filtered and counted on the server, with their dossier permission`() {
        val c = company()
        assertEquals(200, call("PATCH", "/api/v1/users/${c.adminId}", c.adminToken, """{"displayName":"Mariana Ortiz"}""").status)
        val rh = member(c, "rh")
        val unplaced = member(c, "supervisor")
        val placed = member(c, "supervisor")
        val auditor = member(c, "auditor")
        val gone = member(c, "rh")
        val siteId = newSite(c)
        assertEquals(200, call("PATCH", "/api/v1/users/${placed.id}", c.adminToken, """{"siteIds":["$siteId"]}""").status)
        assertEquals(200, call("PATCH", "/api/v1/users/${gone.id}", c.adminToken, """{"disabled":true}""").status)
        val invited = call(
            "POST", "/api/v1/users", c.adminToken,
            """{"email":"laura.gil.${UUID.randomUUID().toString().take(6)}@demo.example","displayName":"Laura Gil","roles":["supervisor"],"siteIds":["$siteId"]}""",
        )
        assertEquals(201, invited.status, invited.toString())
        val laura = invited.at<String>("id")
        assertEquals(200, call("PUT", "/api/v1/users/${auditor.id}/dossier-permission", c.adminToken, """{"enabled":true}""").status)

        assertEquals(listOf(c.adminId), ids(users(c, "?q=MARIANA")))
        assertEquals(listOf(laura), ids(users(c, "?q=laura.gil")))
        assertEquals(listOf(unplaced.id, placed.id, laura), ids(users(c, "?role=supervisor")))
        assertEquals(listOf(laura), ids(users(c, "?status=invited")))
        assertEquals(listOf(gone.id), ids(users(c, "?status=disabled")))
        assertEquals(listOf(rh.id), ids(users(c, "?role=rh&status=active")))
        assertEquals(listOf(auditor.id), ids(users(c, "?dossierPermission=true")))
        val detail = users(c, "?dossierPermission=true")
        assertEquals(true, detail.at("items[0].dossierPermission"))
        assertTrue(detail.at<String>("items[0].dossierPermissionSince").isNotBlank())
        assertEquals(6, ids(users(c, "?dossierPermission=false")).size)

        val counts = call("GET", "/api/v1/users/summary", c.adminToken)
        assertEquals(200, counts.status, counts.toString())
        assertEquals(listOf(7, 5, 1, 1, 1, 1), listOf<Int>(counts.at("total"), counts.at("active"), counts.at("invited"), counts.at("disabled"), counts.at("supervisorsWithoutSites"), counts.at("dossierPermission")))
        assertEquals(mapOf("admin_empresa" to 1, "auditor" to 1, "rh" to 2, "supervisor" to 3, "trabajador" to 0), counts.at<Map<String, Int>>("byRole"))
        assertEquals(1, call("GET", "/api/v1/users/summary?q=laura", c.adminToken).at<Int>("total"))

        // El permiso vale para la cuenta con la que se concedió: soltar la liga lo apaga.
        assertEquals(200, call("POST", "/api/v1/users/${auditor.id}/unlink", c.adminToken).status)
        assertEquals(emptyList(), ids(users(c, "?dossierPermission=true")))
        assertEquals(0, call("GET", "/api/v1/users/summary", c.adminToken).at<Int>("dossierPermission"))

        for (bad in listOf("?role=jefe", "?status=borrada", "?dossierPermission=si")) assertProblem(422, "validation", users(c, bad))
        assertEquals("too_long", errorCode(users(c, "?q=${"a".repeat(101)}")))
        // Sólo quien administra ve a las personas con acceso.
        assertProblem(403, "forbidden", call("GET", "/api/v1/users/summary", rh.token))
    }

    @Test
    fun `the audit log is filtered by who acted, what they touched and the group of actions, and counted up to a cap`() {
        val c = companyWithFinishedWeek()
        val siteId = newSite(c)
        val one = staffed(c, siteId)
        val incident = marked(one, before(40), location = here(latitude = 19.44)).at<String>("incident.id")
        val rh = member(c, "rh")
        assertEquals(200, patch(c, incident, """{"assigneeUserId":"${rh.id}"}""").status)
        fun log(query: String) = call("GET", "/api/v1/audit-log?limit=200$query", c.adminToken)
        fun actions(query: String): List<String> {
            val reply = log(query)
            assertEquals(200, reply.status, reply.toString())
            return reply.list("items[*].action")
        }
        fun total(query: String): Int {
            val reply = call("GET", "/api/v1/audit-log/summary?${query.removePrefix("&")}", c.adminToken)
            assertEquals(200, reply.status, reply.toString())
            assertEquals(listOf(false, 10_000), listOf<Any>(reply.at("capped"), reply.at("cap")))
            return reply.at("total")
        }

        val groups = mapOf(
            "incidents" to listOf("incident."),
            "devices" to listOf("card.", "device."),
            "access" to listOf("user.", "dossier.permission_"),
            "directory" to listOf("employee.", "schedule.", "import."),
            "settings" to listOf("tenant.", "site."),
        )
        for ((group, prefixes) in groups) {
            val found = actions("&group=$group")
            assertTrue(found.isNotEmpty(), group)
            assertTrue(found.all { action -> prefixes.any { action.startsWith(it) } }, "$group: $found")
            assertEquals(found.size, total("&group=$group"), group)
        }
        assertEquals(listOf("incident.assigned", "incident.opened"), actions("&targetType=incident&targetId=$incident"))
        assertEquals(2, total("&targetType=incident&targetId=$incident"))
        assertEquals(listOf("incident.opened"), actions("&actorType=system"))
        val byAdmin = log("&actorId=${c.adminId}")
        assertTrue(byAdmin.list("items[*].actor.id").all { it == c.adminId })
        assertTrue("incident.assigned" in byAdmin.list("items[*].action"))
        assertEquals(listOf("employee.created"), actions("&targetType=employee&targetId=${one.employeeId}&group=directory"))
        assertEquals(actions("").size, total(""))

        assertEquals("required", errorCode(log("&targetId=$incident")))
        for (bad in listOf("&group=otros", "&actorType=robot", "&actorId=x", "&targetId=x&targetType=incident", "&from=ayer")) {
            assertProblem(422, "validation", log(bad))
        }

        // Pasado el tope, la cuenta no sigue: dice que hay más.
        change(
            "insert into audit_log (id, tenant_id, actor_type, actor_id, action, target_type, target_id, correlation_id) " +
                "select gen_random_uuid(), ?, 'system', null, 'incident.opened', 'incident', null, gen_random_uuid() from generate_series(1, 10001)",
            UUID.fromString(c.id),
        )
        val capped = call("GET", "/api/v1/audit-log/summary?group=incidents", c.adminToken)
        assertEquals(listOf<Any>(10_000, true), listOf<Any>(capped.at("total"), capped.at("capped")))
    }
}
