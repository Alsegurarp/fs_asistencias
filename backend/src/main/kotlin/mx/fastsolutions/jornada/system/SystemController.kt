package mx.fastsolutions.jornada.system

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class SystemStatus(
    val service: String,
    val status: String,
    val version: String,
)

@RestController
@RequestMapping("/api/v1/system")
class SystemController {
    @GetMapping("/status")
    fun status() = SystemStatus(
        service = "control-jornada-backend",
        status = "ok",
        version = "0.1.0",
    )
}
