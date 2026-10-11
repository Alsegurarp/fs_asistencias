package mx.fastsolution.zenit.export

import mx.fastsolution.zenit.jobs.JobProperties
import mx.fastsolution.zenit.jobs.JobRepository
import mx.fastsolution.zenit.jobs.JobWorker
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import java.time.Duration
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

class ExportCsvTest {
    private fun row(externalId: String, name: String, site: String? = null, acknowledgement: String? = null) = ClosedRow(
        closureId = UUID.randomUUID(),
        employeeId = UUID.randomUUID(),
        version = 2,
        workedMinutes = 2400,
        breakMinutes = 150,
        ordinaryMinutes = 2400,
        overtimeMinutes = 0,
        hash = "a".repeat(64),
        closedAt = OffsetDateTime.parse("2026-10-12T16:00:00Z"),
        ruleSetVersion = 1,
        jurisdiction = "MX-LFT",
        externalId = externalId,
        displayName = name,
        siteName = site,
        acknowledgement = acknowledgement,
    )

    @Test
    fun `text is quoted, its quotes are doubled and a formula is turned into plain text`() {
        assertEquals("\"Persona Uno\"", ExportCsv.text("Persona Uno"))
        assertEquals("\"Apellido, Nombre\"", ExportCsv.text("Apellido, Nombre"))
        assertEquals("\"Ana \"\"La Güera\"\"\"", ExportCsv.text("Ana \"La Güera\""))
        assertEquals("\"dos\nlíneas\"", ExportCsv.text("dos\nlíneas"))
        assertEquals("\"\"", ExportCsv.text(""))
        // Lo que una hoja de cálculo ejecutaría sale con un apóstrofo delante.
        for (risky in listOf("=1+1", "+52", "-1", "@SUM(A1)", "\tx", "\rx", "\nx", "＝1", "＋1", "－1", "＠x")) {
            assertEquals("\"'$risky\"", ExportCsv.text(risky), risky)
        }
        // Sólo cuenta el primer carácter.
        assertEquals("\"a=b\"", ExportCsv.text("a=b"))
        assertEquals("\"E-1\"", ExportCsv.text("E-1"))
    }

    @Test
    fun `the file starts with the mark a spreadsheet needs and has one line per closure`() {
        val bytes = ExportCsv.render(
            "panificadora", LocalDate.parse("2026-10-05"), "America/Mexico_City",
            listOf(row("E-1", "Núñez, Ana", "Sucursal Centro", "agreed"), row("E-2", "=cmd")),
        )

        assertContentEquals(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()), bytes.copyOfRange(0, 3))
        val lines = String(bytes, 3, bytes.size - 3, Charsets.UTF_8).split("\r\n")
        assertEquals(ExportCsv.HEADER.joinToString(","), lines[0])
        assertEquals(16, ExportCsv.HEADER.size)
        val hash = "a".repeat(64)
        assertEquals(
            "\"panificadora\",2026-10-05,\"America/Mexico_City\",\"MX-LFT\",1,\"E-1\",\"Núñez, Ana\",\"Sucursal Centro\",2,2400,150,2400,0,agreed,2026-10-12T16:00:00Z,$hash",
            lines[1],
        )
        assertEquals(
            "\"panificadora\",2026-10-05,\"America/Mexico_City\",\"MX-LFT\",1,\"E-2\",\"'=cmd\",\"\",2,2400,150,2400,0,,2026-10-12T16:00:00Z,$hash",
            lines[2],
        )
        assertEquals(listOf(""), lines.drop(3))
        // Los mismos cierres dan siempre el mismo archivo, y con él la misma huella.
        val again = ExportCsv.render(
            "panificadora", LocalDate.parse("2026-10-05"), "America/Mexico_City",
            listOf(row("E-1", "Núñez, Ana", "Sucursal Centro", "agreed"), row("E-2", "=cmd")),
        )
        assertEquals(sha256(bytes), sha256(again))
    }

    @Test
    fun `each retry waits twice as long as the one before, up to a limit`() {
        val worker = JobWorker(JobRepository(DSL.using(SQLDialect.POSTGRES)), emptyList(), JobProperties(backoffSeconds = 5))

        assertEquals(listOf(5L, 10L, 20L, 40L), (1..4).map { worker.pause(it).seconds })
        assertEquals(Duration.ofSeconds(5 * 1024), worker.pause(11))
        assertEquals(worker.pause(11), worker.pause(60))
    }
}
