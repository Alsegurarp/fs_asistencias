package mx.fastsolution.zenit.mobile

import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.Shapes
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

internal val ZenitShapes = Shapes(
    extraSmall = RoundedCornerShape(12.dp), small = RoundedCornerShape(16.dp),
    medium = RoundedCornerShape(24.dp), large = RoundedCornerShape(28.dp),
    extraLarge = RoundedCornerShape(36.dp),
)

internal val ZenitColors = lightColorScheme(
    primary = Color(0xFF205EC3), onPrimary = Color.White,
    primaryContainer = Color(0xFFE5EDFA), onPrimaryContainer = Color(0xFF102D55),
    secondary = Color(0xFF315B91), onSecondary = Color.White,
    secondaryContainer = Color(0xFFE5EDFA), onSecondaryContainer = Color(0xFF123566),
    tertiary = Color(0xFF426184), onTertiary = Color.White,
    tertiaryContainer = Color(0xFFE7EEF7), onTertiaryContainer = Color(0xFF1A3555),
    background = Color(0xFFF4F7FD), onBackground = Color(0xFF102957),
    surface = Color(0xFFFCFDFF), onSurface = Color(0xFF102957),
    surfaceVariant = Color(0xFFEDF1F7), onSurfaceVariant = Color(0xFF53647B),
    surfaceTint = Color(0xFF123566), outline = Color(0xFF7A8BA1),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFF7F9FC),
    surfaceContainer = Color(0xFFF0F4FA),
    surfaceContainerHigh = Color(0xFFE9EFF7),
    surfaceContainerHighest = Color(0xFFE1E8F2),
    surfaceDim = Color(0xFFDDE4EE), surfaceBright = Color.White,
    inverseSurface = Color(0xFF20344D), inverseOnSurface = Color(0xFFF4F7FB),
    inversePrimary = Color(0xFFB4CCF1),
)
