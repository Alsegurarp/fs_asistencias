package mx.fastsolution.zenit.mobile

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.MifareClassic
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

private data class ExampleEmployee(val id: String, val name: String, val position: String, val schedule: String) {
    fun payload() = JSONObject().put("version", 1).put("example", true).put("employeeId", id)
        .put("fullName", name).put("position", position).put("schedule", schedule).toString()
}
private data class CardWrite(val uid: String, val employee: ExampleEmployee, val key: ByteArray, val erase: Boolean = false)

class CardProvisioningActivity : ComponentActivity(), NfcAdapter.ReaderCallback {
    private val adapter by lazy { NfcAdapter.getDefaultAdapter(this) }
    private val busy = AtomicBoolean(false)
    private val handler = Handler(Looper.getMainLooper())
    private var waitingForCard by mutableStateOf(false)
    private var loadedIds by mutableStateOf(setOf<String>())
    private val noCard = Runnable {
        armed = null
        waitingForCard = false
        message = "No se detectó una tarjeta. Vuelve a confirmar la carga o el borrado y acércala de nuevo."
    }
    @Volatile private var armed: CardWrite? = null
    @Volatile private var activeCard: MifareClassic? = null
    @Volatile private var readKey = MifareClassic.KEY_DEFAULT.copyOf()
    private var message by mutableStateOf("Selecciona un empleado listo y pulsa Cargar tarjeta.")
    private var uid by mutableStateOf("")
    private var existing by mutableStateOf("")
    private var replaceable by mutableStateOf(false)
    private var working by mutableStateOf(false)
    private val employees = listOf(
        ExampleEmployee("EJ-001", "Mariana Torres Hernández", "Coordinadora de operaciones", "Lun a vie 08:00-16:00"),
        ExampleEmployee("EJ-002", "Diego Ramírez López", "Auxiliar de almacén", "Lun a vie 09:00-17:00"),
    )
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val preferences = getSharedPreferences("example_card_requests", MODE_PRIVATE)
        loadedIds = employees.filter { preferences.contains("employee_card_${it.id}") }.map { it.id }.toSet()
        setContent {
            var selected by remember { mutableIntStateOf(0) }
            var confirm by remember { mutableStateOf(false) }
            var confirmErase by remember { mutableStateOf(false) }
            val employee = employees[selected]
            val validKey = readKey.size == 6
            val waiting = waitingForCard
            MaterialTheme(colorScheme = ZenitColors) {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        TextButton(onClick = { finish() }) { Text("Volver a administración") }
                        Text("Empleados listos para cargar", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                        Text("Dos empleados de ejemplo ya listos para cargar. La aprobación corresponde a nuestro equipo; aquí sólo cargas y consultas sus tarjetas. Estos ejemplos no están registrados en el servidor.", style = MaterialTheme.typography.bodySmall)
                        employees.forEachIndexed { index, item ->
                            OutlinedButton(onClick = { selected = index; armed = null; uid = ""; existing = ""; waitingForCard = false; handler.removeCallbacks(noCard); message = "Empleado listo. Pulsa Cargar tarjeta para continuar." }, enabled = !working,
                                modifier = Modifier.fillMaxWidth()) { Text("${item.id} · ${item.name}\n${if (item.id in loadedIds) "Carga verificada en este teléfono" else "Listo para cargar"}${if (selected == index) " ✓" else ""}") }
                        }
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(employee.name, style = MaterialTheme.typography.titleLarge)
                                Text("ID: ${employee.id}\nPuesto: ${employee.position}\nHorario: ${employee.schedule}")
                                Text(if (employee.id in loadedIds) "Carga verificada en este teléfono" else "Listo para cargar")
                            }
                        }
                        if (working || waiting) {
                            LinearProgressIndicator(Modifier.fillMaxWidth())
                            Text(if (working) "Tarjeta detectada · mantén la tarjeta inmóvil" else "Buscando tarjeta · acércala al teléfono")
                        }
                        Text(message)
                        if (existing.isNotEmpty()) Text(existing)
                        Button(onClick = { confirmErase = false; confirm = true }, enabled = validKey && !working && !waiting,
                            modifier = Modifier.fillMaxWidth()) { Text(if (employee.id in loadedIds) "Volver a cargar tarjeta" else "Cargar tarjeta") }
                        if (waiting) OutlinedButton(onClick = { armed = null; waitingForCard = false; handler.removeCallbacks(noCard); message = "Carga cancelada." }) { Text("Cancelar escritura") }
                        OutlinedButton(onClick = {
                            armed = null; waitingForCard = false; handler.removeCallbacks(noCard)
                            startActivity(Intent(this@CardProvisioningActivity, NfcDiagnosticActivity::class.java))
                        }, enabled = !working, modifier = Modifier.fillMaxWidth()) { Text("Leer tarjeta y validar datos") }
                        OutlinedButton(onClick = { confirmErase = true; confirm = true },
                            enabled = validKey && uid.isNotEmpty() && !working && !waiting,
                            modifier = Modifier.fillMaxWidth()) { Text("Borrar datos Zenit") }
                        Text("Para borrar, acerca primero la tarjeta a esta pantalla para identificarla. Después confirma el borrado y vuelve a acercar la misma tarjeta.", style = MaterialTheme.typography.bodySmall)
                    }
                    if (confirm) AlertDialog(onDismissRequest = { confirm = false },
                        title = { Text(if (confirmErase) "¿Borrar los datos de esta tarjeta?" else "Confirmar escritura física") },
                        text = { Text(if (confirmErase)
                            "Se borrarán los datos guardados en la tarjeta consultada. No podrás recuperarlos desde esta app. Este borrado no da de baja al empleado. Acerca de nuevo la misma tarjeta para continuar."
                            else "${employee.name}\n${employee.position}\n${employee.schedule}\n${employee.id}\n\nSe guardarán estos datos en la tarjeta. Mantén la tarjeta inmóvil hasta finalizar.") },
                        confirmButton = { TextButton(onClick = {
                            armed = CardWrite(uid, employee, readKey.copyOf(), confirmErase)
                            waitingForCard = true
                            message = if (confirmErase) "Acerca la tarjeta consultada para borrar sus datos." else "Esperando tarjeta. Acércala para cargar los datos de ${employee.name}."
                            handler.removeCallbacks(noCard); handler.postDelayed(noCard, 20000); confirm = false
                        }, enabled = !working && (!confirmErase || uid.isNotEmpty())) { Text(if (confirmErase) "Borrar y acercar tarjeta" else "Confirmar y acercar tarjeta") } },
                        dismissButton = { TextButton(onClick = { confirm = false }) { Text("Cancelar") } })
                }
            }
        }
    }
    override fun onResume() {
        super.onResume()
        if (adapter?.isEnabled == true) adapter?.enableReaderMode(this, this,
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK, null)
        else message = "NFC no está disponible. Actívalo en los ajustes del teléfono."
    }
    override fun onPause() {
        armed = null
        waitingForCard = false
        handler.removeCallbacks(noCard)
        activeCard?.let { runCatching { it.close() } }
        adapter?.disableReaderMode(this)
        super.onPause()
    }
    override fun onTagDiscovered(tag: Tag) {
        if (!busy.compareAndSet(false, true)) return
        val task = armed
        armed = null // Every physical write requires a fresh explicit confirmation.
        runOnUiThread { handler.removeCallbacks(noCard); waitingForCard = false; working = true; replaceable = false; existing = ""; message = "Tarjeta detectada. Leyendo contenido…" }
        var writing = false
        try {
            val id = tag.id.joinToString("") { "%02X".format(it.toInt() and 255) }
            require(task == null || task.uid.isEmpty() || task.uid == id) { "La tarjeta no coincide con la confirmada. Vuelve a identificar y confirmar." }
            val card = MifareClassic.get(tag) ?: error("Esta tarjeta o este teléfono no ofrece acceso MIFARE Classic. No se escribió nada.")
            activeCard = card
            try {
                card.connect()
                require(card.type == MifareClassic.TYPE_CLASSIC && card.size == MifareClassic.SIZE_1K) { "Esta herramienta requiere una tarjeta MIFARE Classic de 1 KB." }
                val key = task?.key ?: readKey.copyOf()
                require(key.size == 6) { "Introduce una clave A de 12 caracteres hexadecimales antes de consultar." }
                fun readArea(): ByteArray = CardCredentialReader.read(card, key)
                val before = readArea() // Authenticate and read every target block before changing any data.
                if (task == null) {
                    val safe = CardCredentialFormat.canReplace(before)
                    val content = runCatching { CardCredentialReader.describe(before) }.getOrElse {
                        if (safe) "No hay datos de empleado disponibles. Puedes cargar una credencial." else "No se encontraron datos de empleado reconocibles. Puedes borrar los datos antes de cargar una nueva credencial."
                    }
                    runOnUiThread { uid = id; replaceable = safe; existing = content; message = "Tarjeta consultada. Revisa los datos antes de cargar." }
                } else {
                    check(task.erase || CardCredentialFormat.canReplace(before)) { "La tarjeta contiene otros datos. Consúltala y usa Borrar datos Zenit antes de cargar al empleado." }
                    val prefs = getSharedPreferences("example_card_requests", MODE_PRIVATE)
                    val assigned = prefs.getString("card_$id", null)
                    check(task.erase || assigned == null || assigned == task.employee.id) { "Esta tarjeta está asignada a otro empleado. Para reutilizarla, primero usa Borrar datos Zenit y después carga el nuevo empleado." }
                    val bytes = if (task.erase) ByteArray(CardCredentialFormat.capacity) else CardCredentialFormat.encode(task.employee.payload())
                    fun write(block: Int, data: ByteArray) {
                        check(card.authenticateSectorWithKeyA(card.blockToSector(block), key)) { "Acceso rechazado durante la escritura." }
                        card.writeBlock(block, data)
                    }
                    runOnUiThread { message = if (task.erase) "Borrando datos de la tarjeta… No la retires." else "Cargando datos en la tarjeta… No la retires." }
                    writing = true
                    write(CardCredentialFormat.blocks.first(), CardCredentialFormat.pendingHeader)
                    CardCredentialFormat.blocks.drop(1).forEachIndexed { index, block -> write(block, bytes.copyOfRange((index + 1) * 16, (index + 2) * 16)) }
                    write(CardCredentialFormat.blocks.first(), bytes.copyOfRange(0, 16))
                    runOnUiThread { message = if (task.erase) "Verificando que el área quedó vacía…" else "Datos cargados. Leyendo de nuevo para verificar…" }
                    val verified = readArea()
                    check(verified.contentEquals(bytes)) { "La lectura de verificación no coincide." }
                    if (!task.erase) CardCredentialFormat.decode(verified)
                    if (task.erase) {
                        val editor = prefs.edit().remove("card_$id")
                        employees.filter { prefs.getString("employee_card_${it.id}", null) == id }
                            .forEach { editor.remove("employee_card_${it.id}") }
                        editor.apply()
                    } else {
                        prefs.edit().putString("card_$id", task.employee.id).putString("employee_card_${task.employee.id}", id).apply()
                    }
                    val loaded = employees.filter { prefs.contains("employee_card_${it.id}") }.map { it.id }.toSet()
                    runOnUiThread {
                        uid = id; existing = CardCredentialReader.describe(verified); loadedIds = loaded; replaceable = true
                        message = if (task.erase) "Datos borrados y verificados. Ya puedes cargar otro empleado."
                            else "Datos del empleado cargados y verificados en la tarjeta."
                    }
                }
            } finally { runCatching { card.close() }; activeCard = null }
        } catch (failure: Exception) {
            runOnUiThread {
                uid = ""; existing = ""; replaceable = false
                message = if (writing) "No se confirmó la operación; puede haber quedado parcial. Mantén la tarjeta cerca, vuelve a consultar y repite la carga o el borrado. "
                    else when {
                        failure.message?.contains("asignada") == true -> "Esta tarjeta está asignada a otro empleado. Borra sus datos antes de reutilizarla."
                        failure.message?.contains("coincide") == true -> "La tarjeta no es la que confirmaste. Acerca la tarjeta correcta."
                        failure.message?.contains("contiene otros datos") == true -> "La tarjeta contiene otros datos. Consúltala y borra sus datos antes de cargar al empleado."
                        else -> "No se pudo completar la operación. Mantén la tarjeta cerca e intenta de nuevo. Si continúa, solicita ayuda a Administración."
                    }
            }
        } finally { busy.set(false); runOnUiThread { working = false } }
    }
}
