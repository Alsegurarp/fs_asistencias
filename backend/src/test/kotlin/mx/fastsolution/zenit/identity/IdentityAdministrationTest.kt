package mx.fastsolution.zenit.identity

import mx.fastsolution.zenit.api.ApiException
import tools.jackson.databind.json.JsonMapper
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class IdentityAdministrationTest {
    @Test
    fun `missing configuration or an unsafe transport fails closed`() {
        for (settings in listOf(IdentityAdminProperties(), IdentityAdminProperties("http://remote.invalid", clientSecret = "example"), IdentityAdminProperties("https://secret@example.invalid", clientSecret = "example"))) {
            val failure = assertFailsWith<ApiException> {
                IdentityAdministration(settings, JsonMapper.builder().build()).requirePasswordChange("id", "person@example.invalid")
            }
            assertEquals("identity_unavailable", failure.code)
            assertEquals(503, failure.status.value())
        }
    }
}
