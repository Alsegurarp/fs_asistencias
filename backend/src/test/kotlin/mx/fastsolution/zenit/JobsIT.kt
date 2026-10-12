package mx.fastsolution.zenit

import mx.fastsolution.zenit.jobs.JobHandler
import mx.fastsolution.zenit.jobs.JobRepository
import mx.fastsolution.zenit.jobs.JobRow
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import java.sql.DriverManager
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Trabajo de prueba que falla las veces que se le pida antes de salir bien. */
class FlakyHandler : JobHandler {
    override val type = "prueba_inestable"
    val failuresLeft = ConcurrentHashMap<UUID, Int>()
    val handled = CopyOnWriteArrayList<UUID>()
    val abandoned = CopyOnWriteArrayList<UUID>()

    override fun handle(job: JobRow) {
        val left = failuresLeft.getOrDefault(job.referenceId, 0)
        if (left > 0) {
            failuresLeft[job.referenceId] = left - 1
            throw IllegalStateException("mensaje con un dato que no debe guardarse")
        }
        handled += job.referenceId
    }

    override fun abandoned(job: JobRow, error: String) {
        abandoned += job.referenceId
    }
}

/** Trabajos durables contra PostgreSQL real: reintento, abandono, plazo y dos procesos a la vez. */
@Tag("integration")
@Import(JobsIT.Handlers::class)
class JobsIT : ApiTestBase() {
    @TestConfiguration
    class Handlers {
        @Bean
        fun flakyHandler() = FlakyHandler()
    }

    @Autowired
    private lateinit var jobs: JobRepository

    @Autowired
    private lateinit var flaky: FlakyHandler

    private fun <T> query(statement: String, id: UUID, read: (java.sql.ResultSet) -> T): T =
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement(statement).use {
                it.setObject(1, id)
                it.executeQuery().use { rows ->
                    rows.next()
                    read(rows)
                }
            }
        }

    private class State(val status: String, val attempts: Int, val error: String?, val secondsToNextRun: Long, val finished: Boolean)

    private fun state(id: UUID): State =
        query(
            "select status, attempts, last_error, cast(floor(extract(epoch from next_run_at - now())) as bigint), finished_at is not null " +
                "from job where id = ?",
            id,
        ) {
            State(it.getString(1), it.getInt(2), it.getString(3), it.getLong(4), it.getBoolean(5))
        }

    /** Hace que ya le toque: simula que pasó la pausa. */
    private fun due(id: UUID) {
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement("update job set next_run_at = now() where id = ?").use {
                it.setObject(1, id)
                it.executeUpdate()
            }
        }
    }

    private fun expireLease(id: UUID) {
        DriverManager.getConnection(databaseUrl, "zenit_app", secret("db_app_password")).use { db ->
            db.prepareStatement("update job set lease_until = now() - interval '1 second' where id = ?").use {
                it.setObject(1, id)
                it.executeUpdate()
            }
        }
    }

    @BeforeEach
    fun nothingPending() {
        // Lo que otras pruebas dejaron encolado se atiende antes, para que no se mezcle.
        jobWorker.drain(1000)
    }

    @Test
    fun `a failed job waits longer each time and then succeeds, without keeping the error message`() {
        val reference = UUID.randomUUID()
        flaky.failuresLeft[reference] = 2
        val id = jobs.enqueue(null, flaky.type, reference, 5)

        jobWorker.drain()
        val first = state(id)
        assertEquals(listOf("queued", 1, "IllegalStateException"), listOf(first.status, first.attempts, first.error))
        assertTrue(first.secondsToNextRun in 3..5, "pausa de ${first.secondsToNextRun} s")
        // Mientras dura la pausa nadie lo toma.
        assertFalse(jobWorker.runOne())
        assertEquals(1, state(id).attempts)

        due(id)
        jobWorker.drain()
        val second = state(id)
        assertEquals(listOf("queued", 2), listOf(second.status, second.attempts))
        assertTrue(second.secondsToNextRun in 8..10, "pausa de ${second.secondsToNextRun} s")

        due(id)
        jobWorker.drain()
        val third = state(id)
        assertEquals(listOf("done", 3, true), listOf(third.status, third.attempts, third.finished))
        assertNull(third.error)
        assertEquals(1, flaky.handled.count { it == reference })
        assertFalse(reference in flaky.abandoned)
        // Terminado, no se vuelve a tomar.
        assertFalse(jobWorker.runOne())
    }

    @Test
    fun `a job that keeps failing is abandoned after its attempts and tells whoever was waiting`() {
        val reference = UUID.randomUUID()
        flaky.failuresLeft[reference] = 99
        val id = jobs.enqueue(null, flaky.type, reference, 2)

        jobWorker.drain()
        assertEquals("queued", state(id).status)
        assertFalse(reference in flaky.abandoned)
        due(id)
        jobWorker.drain()
        val last = state(id)
        assertEquals(listOf("failed", 2, "IllegalStateException", true), listOf(last.status, last.attempts, last.error, last.finished))
        assertEquals(1, flaky.abandoned.count { it == reference })
        assertFalse(reference in flaky.handled)
        due(id)
        assertFalse(jobWorker.runOne())

        // Un tipo de trabajo que nadie sabe atender también termina, sin detener a los demás.
        val unknown = jobs.enqueue(null, "tipo_desconocido", UUID.randomUUID(), 1)
        val after = UUID.randomUUID()
        val next = jobs.enqueue(null, flaky.type, after, 1)
        jobWorker.drain()
        assertEquals("failed", state(unknown).status)
        assertEquals("done", state(next).status)
    }

    @Test
    fun `a job whose process died is taken again when its time runs out`() {
        val reference = UUID.randomUUID()
        val id = jobs.enqueue(null, flaky.type, reference, 3)

        // Un proceso lo toma y muere antes de terminarlo.
        assertEquals(id, jobs.claim(120)?.id)
        assertEquals(listOf("running", 1), state(id).let { listOf(it.status, it.attempts) })
        // Mientras su plazo sigue vigente, nadie más lo toma.
        assertFalse(jobWorker.runOne())
        assertFalse(reference in flaky.handled)

        expireLease(id)
        jobWorker.drain()
        assertEquals(listOf("done", 2), state(id).let { listOf(it.status, it.attempts) })
        assertEquals(1, flaky.handled.count { it == reference })

        // Si muere en su último intento, se da por abandonado en la siguiente vuelta.
        val lastChance = UUID.randomUUID()
        val exhausted = jobs.enqueue(null, flaky.type, lastChance, 1)
        assertEquals(exhausted, jobs.claim(120)?.id)
        expireLease(exhausted)
        assertFalse(jobWorker.runOne())
        jobWorker.tick()
        assertEquals(listOf("failed", "lease_expired"), state(exhausted).let { listOf(it.status, it.error) })
        assertEquals(1, flaky.abandoned.count { it == lastChance })
        assertFalse(lastChance in flaky.handled)
    }

    @Test
    fun `several processes at once never take the same job`() {
        val references = List(40) { UUID.randomUUID() }
        val ids = references.map { jobs.enqueue(null, flaky.type, it, 3) }
        val workers = 6
        val pool = Executors.newFixedThreadPool(workers)
        val start = CountDownLatch(1)
        val taken = CopyOnWriteArrayList<Int>()
        repeat(workers) {
            pool.submit {
                start.await()
                taken += jobWorker.drain(1000)
            }
        }
        start.countDown()
        pool.shutdown()
        assertTrue(pool.awaitTermination(60, TimeUnit.SECONDS))

        assertEquals(40, taken.sum())
        for (reference in references) assertEquals(1, flaky.handled.count { it == reference })
        for (id in ids) assertEquals(listOf("done", 1), state(id).let { listOf(it.status, it.attempts) })
        // De verdad trabajó más de un proceso.
        assertTrue(taken.count { it > 0 } > 1, "repartido: $taken")
    }
}
