package mx.fastsolution.zenit.mobile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

private enum class AttendanceCategory(val label: String, val ink: Color, val background: Color) {
    ON_TIME("Puntuales", Color(0xFF17623A), Color(0xFFE1F3E7)),
    LATE("Retardos", Color(0xFF855500), Color(0xFFFFF0CC)),
    ABSENT("Faltas", Color(0xFFAA263A), Color(0xFFFFE5E9)),
    VACATION("Vacaciones", Color(0xFF215B9B), Color(0xFFE5EFFB)),
    JUSTIFIED("Justificados", Color(0xFF6A419A), Color(0xFFF0E7FB)),
}

private data class DemoEmployee(
    val name: String, val number: String, val department: String,
    val punctual: Int = 0, val late: Int = 0, val absent: Int = 0,
    val vacation: Int = 0, val justified: Int = 0,
) {
    val entries get() = punctual + late
    val days get() = punctual + late + absent + vacation + justified
    fun count(category: AttendanceCategory) = when (category) {
        AttendanceCategory.ON_TIME -> punctual; AttendanceCategory.LATE -> late
        AttendanceCategory.ABSENT -> absent; AttendanceCategory.VACATION -> vacation
        AttendanceCategory.JUSTIFIED -> justified
    }
}

/** Isolated administrative prototype: blank credentials never authorize API access. */
@Composable
internal fun AdminDemo(modifier: Modifier = Modifier, onClose: () -> Unit) {
    var signedIn by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var selectedNumber by rememberSaveable { mutableStateOf<String?>(null) }
    var query by rememberSaveable { mutableStateOf("") }
    var adding by rememberSaveable { mutableStateOf(false) }
    var employeeName by rememberSaveable { mutableStateOf("") }
    var employeeNumber by rememberSaveable { mutableStateOf("") }
    var department by rememberSaveable { mutableStateOf("") }
    val employees = remember { mutableStateListOf(
        DemoEmployee("Roberto AR", "EMP-001", "Operaciones", 10, 2, 2, 3, 3),
        DemoEmployee("Mariana Torres", "EMP-002", "Administración", 16, 1, 1, 2, 0),
        DemoEmployee("Diego Ruiz", "EMP-003", "Almacén", 12, 4, 2, 0, 2),
        DemoEmployee("Sofía Luna", "EMP-004", "Ventas", 14, 0, 0, 4, 2),
    ) }
    val selected = employees.firstOrNull { it.number == selectedNumber }
    BackHandler {
        if (selectedNumber != null) selectedNumber = null else onClose()
    }
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("ZENIT · ADMINISTRACIÓN", style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        if (!signedIn) {
            Text("Control de tu equipo", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text("Empleados y asistencia mensual, en un solo lugar.")
            OutlinedTextField(email, { email = it }, label = { Text("Correo") },
                singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(password, { password = it }, label = { Text("Contraseña") },
                visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
            Button(onClick = { signedIn = true; password = "" }, modifier = Modifier.fillMaxWidth()) { Text("Entrar como Administrador") }
            TextButton(onClick = onClose) { Text("Volver a mi asistencia") }
        } else if (selected != null) {
            TextButton(onClick = { selectedNumber = null }) { Text("Volver a empleados") }
            Text(selected.name, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("${selected.number} · ${selected.department}")
            Text("$presentationMonthLabel · ${selected.entries}/${selected.days} entradas")
            Text("Puntual: entrada hasta 10 minutos después del horario asignado. A partir del minuto 11: retardo.",
                style = MaterialTheme.typography.bodyMedium)
            AttendanceCategory.entries.forEach { category ->
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = category.background)) {
                    Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(category.label, color = category.ink, fontWeight = FontWeight.SemiBold)
                        Text(selected.count(category).toString(), color = category.ink,
                            style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Text("Historial del mes", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            HistoricalRows(presentationDays(selected.punctual, selected.late, selected.absent, selected.vacation, selected.justified))
        } else {
            Text("Empleados", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text("$presentationMonthLabel · 20 días programados")
            Button(onClick = { adding = true }, modifier = Modifier.fillMaxWidth()) { Text("Agregar empleado") }
            OutlinedTextField(query, { query = it }, label = { Text("Buscar nombre o número") },
                singleLine = true, modifier = Modifier.fillMaxWidth())
            val filtered = employees.filter { it.name.contains(query, true) || it.number.contains(query, true) }
            filtered.forEach { employee ->
                Card(Modifier.fillMaxWidth().clickable { selectedNumber = employee.number },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f)) {
                                Text(employee.name, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleMedium)
                                Text("${employee.number} · ${employee.department}", style = MaterialTheme.typography.bodySmall)
                            }
                            Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.small) {
                                Column(Modifier.padding(10.dp)) {
                                    Text("${employee.entries}/${employee.days}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                    Text("Entradas", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AttendanceCategory.entries.take(3).forEach { category ->
                                Surface(color = category.background, shape = MaterialTheme.shapes.small) {
                                    Text("${category.label} ${employee.count(category)}", Modifier.padding(6.dp),
                                        color = category.ink, style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        Text("Ver detalle mensual →", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
            if (filtered.isEmpty()) Text("No hay empleados que coincidan con tu búsqueda.")
            TextButton(onClick = { signedIn = false; email = ""; query = "" }) { Text("Cerrar sesión") }
            TextButton(onClick = onClose) { Text("Volver a mi asistencia") }
        }
    }
    if (adding) {
        val duplicate = employees.any { it.number.equals(employeeNumber.trim(), true) }
        AlertDialog(onDismissRequest = { adding = false }, title = { Text("Agregar empleado") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(employeeName, { employeeName = it }, label = { Text("Nombre") }, singleLine = true)
                    OutlinedTextField(employeeNumber, { employeeNumber = it }, label = { Text("Número de empleado") },
                        singleLine = true, isError = duplicate,
                        supportingText = { if (duplicate) Text("Ese número ya existe.") })
                    OutlinedTextField(department, { department = it }, label = { Text("Área") }, singleLine = true)
                }
            },
            confirmButton = { Button(enabled = employeeName.isNotBlank() && employeeNumber.isNotBlank() && !duplicate,
                onClick = {
                    employees.add(DemoEmployee(employeeName.trim(), employeeNumber.trim(), department.trim().ifBlank { "Sin área" }))
                    employeeName = ""; employeeNumber = ""; department = ""; adding = false
                }) { Text("Agregar") } },
            dismissButton = { TextButton(onClick = { adding = false }) { Text("Cancelar") } },
        )
    }
}
