package mx.fastsolution.zenit.mobile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

internal val ZenitBlue = Brush.linearGradient(listOf(Color(0xFF2977E5), Color(0xFF163F81)))
internal val ZenitBodyShape = RoundedCornerShape(topStart = 36.dp, topEnd = 36.dp)

@Composable
internal fun ZenitPage(title: String, onBack: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().safeDrawingPadding().background(MaterialTheme.colorScheme.background)) {
        ZenitHeader(title, onBack = onBack)
        Column(Modifier.weight(1f).offset(y = (-24).dp).clip(ZenitBodyShape)
            .background(MaterialTheme.colorScheme.background).verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
    }
}

@Composable
internal fun ZenitBrand(light: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Canvas(Modifier.size(30.dp)) {
            val u = size.width / 30f
            val wave = Path().apply {
                moveTo(3*u, 11*u); cubicTo(11*u, 1*u, 17*u, 21*u, 27*u, 10*u)
                moveTo(3*u, 21*u); cubicTo(13*u, 10*u, 19*u, 30*u, 27*u, 19*u)
            }
            drawPath(wave, Color(0xFF8EC8FF), style = Stroke(5*u, cap = StrokeCap.Round))
        }
        Text("Zenit", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
            color = if (light) Color.White else MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
internal fun ZenitHeader(title: String, subtitle: String? = null, home: Boolean = false,
    onBack: (() -> Unit)? = null, trailing: @Composable RowScope.() -> Unit = {}) {
    Box(Modifier.fillMaxWidth().background(ZenitBlue)) {
        Canvas(Modifier.matchParentSize()) {
            drawCircle(Color.White.copy(alpha = .05f), size.width * .3f, Offset(size.width, size.height * .8f))
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(top = 20.dp, bottom = 46.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)) {
            if (home) ZenitBrand(light = true)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (onBack != null) FilledTonalIconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Volver" },
                    colors = IconButtonDefaults.filledTonalIconButtonColors(containerColor = Color.White.copy(alpha = .13f), contentColor = Color.White)) {
                    NavigationGlyph("Volver")
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(title, color = Color.White, style = if (home) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold)
                    if (!subtitle.isNullOrBlank()) Text(subtitle, color = Color.White.copy(alpha = .9f), style = MaterialTheme.typography.bodyMedium)
                }
                trailing()
            }
        }
    }
}

@Composable
internal fun ZenitIconTile(destination: String) {
    Box(Modifier.size(52.dp).clip(RoundedCornerShape(18.dp))
        .background(Brush.linearGradient(listOf(Color(0xFFE9F3FF), Color(0xFFCEE3FF)))), contentAlignment = Alignment.Center) {
        CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.primary) { NavigationGlyph(destination) }
    }
}

@Composable
internal fun ZenitLink(title: String, subtitle: String, destination: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(26.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            ZenitIconTile(destination)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text("›", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.headlineSmall)
        }
    }
}

/** Vector illustration stays sharp on phones and requires no external image asset. */
@Composable
internal fun NfcIllustration(modifier: Modifier = Modifier) {
    Canvas(modifier.size(230.dp)) {
        val center = Offset(size.width / 2, size.height / 2)
        for ((radius, alpha) in listOf(.5f to .04f, .42f to .07f, .34f to .12f))
            drawCircle(Color(0xFF2476ED).copy(alpha = alpha), size.width * radius, center)
        val u = size.width / 100f
        for (i in 0..3) {
            val r = (10 + i * 6) * u
            drawArc(Color(0xFF2476ED), -42f, 84f, false,
                Offset(48*u-r, 39*u-r), Size(2*r, 2*r), style = Stroke(2.5f*u, cap = StrokeCap.Round))
        }
        drawRoundRect(Color.White, Offset(25*u, 58*u), Size(52*u, 26*u), androidx.compose.ui.geometry.CornerRadius(5*u))
        drawCircle(Color(0xFFABD0FF), 4*u, Offset(36*u, 67*u))
        drawRoundRect(Color(0xFFABD0FF), Offset(30*u, 73*u), Size(12*u, 6*u), androidx.compose.ui.geometry.CornerRadius(3*u))
        for (y in listOf(66, 73)) drawLine(Color(0xFFCAE0FF), Offset(48*u, y*u), Offset(70*u, y*u), 2.5f*u, StrokeCap.Round)
    }
}

@Composable
internal fun ZenitPrimaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = enabled, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)
        .clip(CircleShape).background(if (enabled) ZenitBlue else Brush.linearGradient(listOf(Color(0xFFDDE4EE), Color(0xFFDDE4EE)))),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, disabledContainerColor = Color.Transparent)) {
        Text(label, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
internal fun ZenitWeekSummary(days: Int, hours: String, incidents: Int) {
    Card(shape = RoundedCornerShape(26.dp), colors = CardDefaults.cardColors(containerColor = Color.Transparent)) {
        Column(Modifier.fillMaxWidth().background(ZenitBlue).padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Tiempo trabajado", color = Color.White, style = MaterialTheme.typography.titleMedium)
            Text(hours, color = Color.White, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        }
    }
    Card(shape = RoundedCornerShape(26.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            for ((value, label) in listOf(days.toString() to "Días con registros", incidents.toString() to "Incidencias")) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
