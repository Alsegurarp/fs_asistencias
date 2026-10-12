package mx.fastsolution.zenit.jobs

import org.jooq.DSLContext
import org.jooq.Record
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository
import java.time.Duration
import java.util.UUID

/** Cómo se atienden los trabajos. Todo tiene un valor seguro por defecto. */
@ConfigurationProperties("zenit.jobs")
data class JobProperties(
    /** Apagado, nadie toma trabajos solo: sirve para probar llamando al trabajador a mano. */
    val enabled: Boolean = true,
    val pollIntervalMs: Long = 2000,
    /** Tiempo que un proceso conserva un trabajo antes de que otro pueda tomarlo. */
    val leaseSeconds: Long = 120,
    val maxAttempts: Int = 5,
    /** Pausa tras el primer fallo; cada intento la duplica. */
    val backoffSeconds: Long = 5,
    /** Trabajos que se atienden como máximo en cada vuelta. */
    val batch: Int = 20,
)

data class JobRow(val id: UUID, val tenantId: UUID?, val type: String, val referenceId: UUID, val attempts: Int, val maxAttempts: Int)

/** Lo que sabe hacer un tipo de trabajo. */
interface JobHandler {
    val type: String

    /** Hace el trabajo. Una excepción lo deja para otro intento. */
    fun handle(job: JobRow)

    /** El trabajo agotó sus intentos: deja constancia en lo que estaba esperándolo. */
    fun abandoned(job: JobRow, error: String)

    /** Tarea periódica propia del tipo, como vencer lo que caducó. */
    fun maintain() {}
}

@Repository
class JobRepository(private val dsl: DSLContext) {
    fun enqueue(tenantId: UUID?, type: String, referenceId: UUID, maxAttempts: Int): UUID {
        val id = UUID.randomUUID()
        dsl.execute(
            "insert into job (id, tenant_id, type, reference_id, status, max_attempts) values (?, cast(? as uuid), ?, ?, 'queued', ?)",
            id, tenantId, type, referenceId, maxAttempts,
        )
        return id
    }

    /**
     * Toma un trabajo pendiente, o uno cuyo proceso murió, y lo aparta por un
     * tiempo. Dos procesos nunca toman el mismo: el que llega segundo se lo
     * salta en lugar de esperar.
     */
    fun claim(leaseSeconds: Long): JobRow? =
        dsl.fetchOne(
            "update job set status = 'running', attempts = attempts + 1, lease_until = now() + (? * interval '1 second') " +
                "where id = (select id from job where attempts < max_attempts and ((status = 'queued' and next_run_at <= now()) " +
                "or (status = 'running' and lease_until <= now())) order by next_run_at, created_at limit 1 for update skip locked) " +
                "returning id, tenant_id, type, reference_id, attempts, max_attempts",
            leaseSeconds,
        )?.let(::row)

    /** Alarga el plazo de un trabajo largo que sigue vivo, para que nadie más lo tome. */
    fun extend(id: UUID, leaseSeconds: Long) {
        dsl.execute("update job set lease_until = now() + (? * interval '1 second') where id = ? and status = 'running'", leaseSeconds, id)
    }

    fun done(id: UUID) {
        dsl.execute("update job set status = 'done', lease_until = null, last_error = null, finished_at = now() where id = ?", id)
    }

    fun retry(id: UUID, pause: Duration, error: String) {
        dsl.execute(
            "update job set status = 'queued', lease_until = null, last_error = ?, next_run_at = now() + (? * interval '1 second') where id = ?",
            error, pause.seconds, id,
        )
    }

    fun fail(id: UUID, error: String) {
        dsl.execute("update job set status = 'failed', lease_until = null, last_error = ?, finished_at = now() where id = ?", error, id)
    }

    /** Trabajos cuyo proceso murió en su último intento: nadie más los va a tomar. */
    fun failExhausted(): List<JobRow> =
        dsl.fetch(
            "update job set status = 'failed', lease_until = null, last_error = 'lease_expired', finished_at = now() " +
                "where status = 'running' and lease_until <= now() and attempts >= max_attempts " +
                "returning id, tenant_id, type, reference_id, attempts, max_attempts",
        ).map { row(it) }

    private fun row(r: Record) = JobRow(
        id = r.get("id", UUID::class.java),
        tenantId = r.get("tenant_id", UUID::class.java),
        type = r.get("type", String::class.java),
        referenceId = r.get("reference_id", UUID::class.java),
        attempts = r.get("attempts", Number::class.java).toInt(),
        maxAttempts = r.get("max_attempts", Number::class.java).toInt(),
    )
}

/**
 * Atiende los trabajos de uno en uno. Tomar, hacer y cerrar son pasos
 * separados: si el proceso muere a la mitad, el trabajo queda apartado hasta
 * que vence su plazo y otro lo toma.
 */
@Component
class JobWorker(private val jobs: JobRepository, handlers: List<JobHandler>, private val properties: JobProperties) {
    private val log = LoggerFactory.getLogger(JobWorker::class.java)
    private val byType = handlers.associateBy { it.type }

    /** Atiende un trabajo. Devuelve falso cuando no había ninguno pendiente. */
    fun runOne(): Boolean {
        val job = jobs.claim(properties.leaseSeconds) ?: return false
        val handler = byType[job.type]
        try {
            checkNotNull(handler) { "Tipo de trabajo sin quien lo atienda" }
            handler.handle(job)
            jobs.done(job.id)
        } catch (e: Exception) {
            // Sólo la clase del error: su mensaje puede traer datos.
            val error = e::class.simpleName ?: "error"
            if (job.attempts >= job.maxAttempts) {
                jobs.fail(job.id, error)
                abandon(handler, job, error)
                log.error("Trabajo {} de tipo {} abandonado tras {} intentos: {}", job.id, job.type, job.attempts, error)
            } else {
                jobs.retry(job.id, pause(job.attempts), error)
                log.warn("Trabajo {} de tipo {} falló en el intento {}: {}", job.id, job.type, job.attempts, error)
            }
        }
        return true
    }

    /** Atiende lo pendiente, hasta un máximo. Devuelve cuántos trabajos atendió. */
    fun drain(max: Int = properties.batch): Int {
        var done = 0
        while (done < max && runOne()) done++
        return done
    }

    /** Una vuelta completa: cierra lo que quedó sin dueño, atiende lo pendiente y da mantenimiento. */
    fun tick() {
        jobs.failExhausted().forEach {
            abandon(byType[it.type], it, "lease_expired")
            log.error("Trabajo {} de tipo {} abandonado: su proceso murió en el último intento", it.id, it.type)
        }
        drain()
        byType.values.forEach { it.maintain() }
    }

    /** Cada intento espera el doble que el anterior. */
    fun pause(attempts: Int): Duration =
        Duration.ofSeconds(properties.backoffSeconds * (1L shl (attempts - 1).coerceIn(0, MAX_DOUBLINGS)))

    private fun abandon(handler: JobHandler?, job: JobRow, error: String) {
        try {
            handler?.abandoned(job, error)
        } catch (e: Exception) {
            log.error("No se pudo dejar constancia del abandono del trabajo {}: {}", job.id, e::class.simpleName)
        }
    }

    private companion object {
        const val MAX_DOUBLINGS = 10
    }
}

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(JobProperties::class)
class JobConfig

/** Da las vueltas del trabajador. El paso de migraciones no atiende trabajos. */
@Configuration(proxyBeanMethods = false)
@Profile("!migrate")
@ConditionalOnProperty(prefix = "zenit.jobs", name = ["enabled"], havingValue = "true", matchIfMissing = true)
@EnableScheduling
class JobSchedule(private val worker: JobWorker) {
    private val log = LoggerFactory.getLogger(JobSchedule::class.java)

    @Scheduled(fixedDelayString = "\${zenit.jobs.poll-interval-ms:2000}", initialDelayString = "\${zenit.jobs.poll-interval-ms:2000}")
    fun turn() {
        try {
            worker.tick()
        } catch (e: Exception) {
            // Una vuelta fallida no detiene las siguientes.
            log.error("Vuelta de trabajos fallida: {}", e::class.simpleName)
        }
    }
}
