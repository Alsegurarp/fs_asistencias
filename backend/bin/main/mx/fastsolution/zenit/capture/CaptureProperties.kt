package mx.fastsolution.zenit.capture

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/** Reglas de los dispositivos y de la captura. Todas tienen un valor seguro por defecto. */
@ConfigurationProperties("zenit.capture")
data class CaptureProperties(
    /** Valor que el dispositivo pone en `aud` de sus aserciones. */
    val audience: String = "zenit-capture",
    /** Vida máxima de una aserción del dispositivo. */
    val tokenMaxAgeSeconds: Long = 120,
    /** Desfase de reloj que se le tolera al dispositivo al autenticarse. */
    val clockSkewSeconds: Long = 60,
    val enrollmentTtlMinutes: Long = 15,
    /** Lo que una sesión sigue valiendo sin conexión. */
    val offlineMaxAgeHours: Long = 72,
    val offlineMaxEvents: Int = 1000,
    /** Tiempo durante el que una terminal reutiliza una muestra de ubicación. */
    val terminalLocationReuseSeconds: Int = 30,
    /** Dos lecturas de la misma persona en menos de esto son una sola marca repetida. */
    val duplicateWindowSeconds: Long = 60,
    /** Pasado este tiempo sin marcar, la siguiente marca abre una jornada nueva. */
    val shiftGapHours: Long = 16,
    /** Un marcaje que llega más tarde que esto abre una incidencia. */
    val lateSyncHours: Long = 24,
    /** Cuánto puede adelantarse la hora del dispositivo a la del servidor sin incidencia. */
    val futureToleranceSeconds: Long = 300,
    /**
     * Acepta la tarjeta simulada del prototipo, que no está autenticada. Nace
     * apagado: nunca basta para aceptar un marcaje con datos reales.
     */
    val simulatedCards: Boolean = false,
    /** Intentos fallidos de activación que se toleran por dirección y por minuto. */
    val activationFailuresPerMinute: Int = 10,
    /** Peticiones que se le aceptan a un dispositivo por minuto. */
    val deviceRequestsPerMinute: Int = 240,
)

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(CaptureProperties::class)
class CaptureConfig

/**
 * Cuota por ventana fija, en memoria. Sirve mientras el backend corra en una
 * sola instancia; con más de una, cada instancia lleva su propia cuenta.
 */
class FixedWindowLimiter(private val window: Duration, private val clock: Clock = Clock.systemUTC()) {
    private class Counter(val startedAt: Instant, var hits: Int)

    private val counters = ConcurrentHashMap<String, Counter>()

    /** Cuenta un uso. Devuelve falso cuando esa clave ya agotó su cuota en la ventana. */
    fun tryAcquire(key: String, limit: Int): Boolean {
        val now = clock.instant()
        if (counters.size > MAX_KEYS) counters.entries.removeIf { it.value.startedAt.plus(window) <= now }
        var allowed = false
        counters.compute(key) { _, current ->
            val counter = if (current == null || current.startedAt.plus(window) <= now) Counter(now, 0) else current
            counter.hits++
            allowed = counter.hits <= limit
            counter
        }
        return allowed
    }

    /** Consulta sin contar: si la clave ya agotó su cuota. */
    fun exhausted(key: String, limit: Int): Boolean {
        val counter = counters[key] ?: return false
        return counter.startedAt.plus(window) > clock.instant() && counter.hits >= limit
    }

    private companion object {
        const val MAX_KEYS = 10_000
    }
}
