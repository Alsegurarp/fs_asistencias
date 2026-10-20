package mx.fastsolution.zenit.user

import mx.fastsolution.zenit.api.Page
import mx.fastsolution.zenit.api.PageKey
import mx.fastsolution.zenit.api.Paging
import mx.fastsolution.zenit.identity.CurrentPerson
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

data class UserView(
    val id: String,
    val email: String,
    val displayName: String,
    val roles: List<String>,
    val status: String,
    val createdAt: String,
    val linkedAt: String?,
    val employeeId: String?,
) {
    companion object {
        fun of(row: UserRow) = UserView(
            id = row.id.toString(),
            email = row.email,
            displayName = row.displayName,
            roles = row.roles.sorted(),
            status = row.status,
            createdAt = row.createdAt.toInstant().toString(),
            linkedAt = row.linkedAt?.toInstant()?.toString(),
            employeeId = row.employeeId?.toString(),
        )
    }
}

/** Personas de la empresa de quien llama. Sólo quien la administra entra aquí. */
@RestController
@RequestMapping("/api/v1/users")
class UserController(private val service: UserService) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal admin: CurrentPerson,
        @RequestParam cursor: String?,
        @RequestParam limit: String?,
    ): Page<UserView> {
        val size = Paging.limit(limit)
        return Paging.page(service.page(admin, Paging.decode(cursor), size), size, { PageKey(it.createdAt, it.id) }) { UserView.of(it) }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun invite(@AuthenticationPrincipal admin: CurrentPerson, @RequestBody request: UserCreateRequest): UserView =
        UserView.of(service.invite(admin, request))

    @GetMapping("/{userId}")
    fun get(@AuthenticationPrincipal admin: CurrentPerson, @PathVariable userId: UUID): UserView =
        UserView.of(service.get(admin, userId))

    @PatchMapping("/{userId}")
    fun update(
        @AuthenticationPrincipal admin: CurrentPerson,
        @PathVariable userId: UUID,
        @RequestBody request: UserUpdateRequest,
    ): UserView = UserView.of(service.update(admin, userId, request))

    @PostMapping("/{userId}/unlink")
    fun unlink(@AuthenticationPrincipal admin: CurrentPerson, @PathVariable userId: UUID): UserView =
        UserView.of(service.unlink(admin, userId))

    @PostMapping("/{userId}/password-change")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun requirePasswordChange(@AuthenticationPrincipal admin: CurrentPerson, @PathVariable userId: UUID) =
        service.requirePasswordChange(admin, userId)
}
