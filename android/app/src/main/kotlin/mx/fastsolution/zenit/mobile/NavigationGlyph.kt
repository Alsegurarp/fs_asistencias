package mx.fastsolution.zenit.mobile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

/** Small consistent outline icons, drawn locally without an additional icon library. */
@Composable
internal fun NavigationGlyph(destination: String) {
    val ink = LocalContentColor.current
    Canvas(Modifier.size(24.dp)) {
        val unit = size.width / 24f
        val outline = Stroke(1.7f * unit)
        fun line(x: Float, y: Float, x2: Float, y2: Float) =
            drawLine(ink, Offset(x * unit, y * unit), Offset(x2 * unit, y2 * unit), strokeWidth = 1.7f * unit)
        fun box(x: Float, y: Float, width: Float, height: Float) =
            drawRoundRect(ink, Offset(x * unit, y * unit), Size(width * unit, height * unit),
                CornerRadius(2 * unit), style = outline)
        when (destination) {
            "Resumen" -> { box(3f, 3f, 7f, 7f); box(14f, 3f, 7f, 7f); box(3f, 14f, 7f, 7f); box(14f, 14f, 7f, 7f) }
            "Tarjetas" -> { box(2f, 5f, 20f, 14f); line(2f, 10f, 22f, 10f); line(5f, 15f, 10f, 15f) }
            "Empleados", "Cuenta" -> {
                drawCircle(ink, 3.5f * unit, Offset(12f * unit, 7f * unit), style = outline)
                val arch = Path().apply {
                    moveTo(4f * unit, 21f * unit); cubicTo(4f * unit, 10f * unit, 20f * unit, 10f * unit, 20f * unit, 21f * unit)
                }
                drawPath(arch, ink, style = outline)
                if (destination == "Empleados") { line(2f, 11f, 2f, 17f); line(22f, 11f, 22f, 17f) }
            }
            "Inicio" -> {
                val roof = Path().apply { moveTo(2f * unit, 11f * unit); lineTo(12f * unit, 3f * unit); lineTo(22f * unit, 11f * unit) }
                drawPath(roof, ink, style = outline); line(5f, 10f, 5f, 21f); line(19f, 10f, 19f, 21f); line(5f, 21f, 19f, 21f)
            }
            "Actividad" -> { line(2f, 13f, 6f, 13f); line(6f, 13f, 10f, 5f); line(10f, 5f, 14f, 20f); line(14f, 20f, 18f, 11f); line(18f, 11f, 22f, 11f) }
            "Mi semana" -> { box(3f, 5f, 18f, 16f); line(3f, 10f, 21f, 10f); line(7f, 2f, 7f, 7f); line(17f, 2f, 17f, 7f); line(7f, 15f, 10f, 15f); line(14f, 15f, 17f, 15f) }
            else -> { box(6f, 2f, 12f, 20f); line(10f, 18f, 14f, 18f) }
        }
    }
}
