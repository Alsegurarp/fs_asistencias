package mx.fastsolution.zenit.employee

import mx.fastsolution.zenit.schedule.ScheduleDay
import java.time.LocalTime
import kotlin.test.Test
import kotlin.test.assertEquals

class CsvTest {
    @Test
    fun `reads quoted fields, escaped quotes and line breaks inside a field`() {
        val rows = Csv.parse("a,b,c\r\n1,\"Apellido, Nombre\",\"dice \"\"hola\"\"\"\n2,\"dos\nlíneas\",fin\n")

        assertEquals(listOf("a", "b", "c"), rows[0].second)
        assertEquals(listOf("1", "Apellido, Nombre", "dice \"hola\""), rows[1].second)
        assertEquals(listOf("2", "dos\nlíneas", "fin"), rows[2].second)
    }

    @Test
    fun `numbers each row by the line where it starts and skips blank lines`() {
        val rows = Csv.parse("﻿a,b\n\n1,\"dos\nlíneas\"\n2,x")

        assertEquals(listOf(1, 3, 5), rows.map { it.first })
        assertEquals(listOf("a", "b"), rows[0].second)
        assertEquals(listOf("2", "x"), rows[2].second)
    }

    @Test
    fun `keeps empty trailing fields and tells a short row apart`() {
        val rows = Csv.parse("a,b,c,d\n1,2,3,\n1,2,3\n")

        assertEquals(4, rows[1].second.size)
        assertEquals("", rows[1].second[3])
        assertEquals(3, rows[2].second.size)
        assertEquals(emptyList(), Csv.parse(""))
    }
}

class ScheduleDayTest {
    @Test
    fun `a shift that ends before it starts runs into the next day`() {
        assertEquals(510, ScheduleDay("monday", LocalTime.of(8, 0), LocalTime.of(16, 30), 30).minutes)
        assertEquals(480, ScheduleDay("friday", LocalTime.of(22, 0), LocalTime.of(6, 0), 30).minutes)
    }
}
