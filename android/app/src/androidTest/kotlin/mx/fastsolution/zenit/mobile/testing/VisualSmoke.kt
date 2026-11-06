package mx.fastsolution.zenit.mobile.testing

import android.app.Instrumentation
import android.content.Intent
import android.graphics.Bitmap
import android.os.SystemClock
import android.view.KeyEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.io.File
import java.time.Instant

/** Recorre el selector y la transición de la pantalla de producto sin datos operativos. */
internal fun Instrumentation.visualSmoke(): String {
    val output = File(targetContext.getExternalFilesDir(null), "visual-break-policy").apply { mkdirs() }
    fun waitUntil(message: String, condition: () -> Boolean) {
        val until = SystemClock.elapsedRealtime() + 5_000
        while (!condition()) {
            check(SystemClock.elapsedRealtime() < until) { message }
            SystemClock.sleep(100)
        }
    }
    fun nodes(text: String): List<AccessibilityNodeInfo> {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        uiAutomation.rootInActiveWindow?.let(queue::add)
        val found = mutableListOf<AccessibilityNodeInfo>()
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            if (node.text?.toString() == text) found += node
            for (index in 0 until node.childCount) node.getChild(index)?.let(queue::add)
        }
        return found
    }
    fun click(text: String) {
        waitUntil("No aparece $text") { nodes(text).isNotEmpty() }
        var node = nodes(text).first()
        while (!node.isClickable) node = checkNotNull(node.parent) { "No es pulsable $text" }
        check(node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { "No se pudo pulsar $text" }
        waitForIdleSync()
    }
    fun screenshot(name: String) {
        waitForIdleSync()
        SystemClock.sleep(300)
        waitUntil("Pantalla ajena al ensayo") { uiAutomation.rootInActiveWindow?.packageName?.toString() == targetContext.packageName }
        val bitmap = checkNotNull(uiAutomation.takeScreenshot()) { "No se pudo capturar la pantalla" }
        File(output, "$name.png").outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        bitmap.recycle()
    }
    for ((current, upcoming) in listOf("not_considered" to "marked", "marked" to "not_considered")) {
        val deadline = Instant.now().plusSeconds(15)
        val activity = startActivitySync(Intent(targetContext, BreakPolicyVisualActivity::class.java)
            .putExtra("current", current).putExtra("upcoming", upcoming).putExtra("effectiveAt", deadline.toString())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as BreakPolicyVisualActivity
        try {
            waitUntil("No se muestra el aviso inicial") { activity.uiState.breakPolicy == current && activity.uiState.breakPolicyNotice != null }
            screenshot("$current-before")
            click("Seleccionar tipo de registro")
            if (current == "marked") {
                waitUntil("Falta el inicio de descanso") { nodes("Inicio de descanso").isNotEmpty() }
                check(nodes("Fin de descanso").isNotEmpty())
                screenshot("$current-selector-before")
                click("Inicio de descanso")
                waitUntil("No se seleccionó descanso") { activity.selectedType == "break_start" }
                screenshot("$current-selected-before")
            } else {
                check(nodes("Inicio de descanso").isEmpty() && nodes("Fin de descanso").isEmpty())
                screenshot("$current-selector-before")
                sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
            }
            while (Instant.now().isBefore(deadline)) SystemClock.sleep(100)
            waitUntil("No se actualizó la política y el aviso") { activity.uiState.breakPolicy == upcoming && activity.uiState.breakPolicyNotice == null }
            if (upcoming == "not_considered") waitUntil("No se retiró la selección de descanso") { activity.selectedType == null }
            screenshot("$current-after")
            click("Seleccionar tipo de registro")
            if (upcoming == "marked") {
                waitUntil("Falta inicio de descanso tras la vigencia") { nodes("Inicio de descanso").isNotEmpty() }
                check(nodes("Fin de descanso").isNotEmpty())
            } else check(nodes("Inicio de descanso").isEmpty() && nodes("Fin de descanso").isEmpty())
            screenshot("$current-selector-after")
        } finally {
            runOnMainSync { activity.finish() }
            waitForIdleSync()
        }
    }
    return "VISUAL: aviso, vigencia, selector y limpieza de selección en ambos sentidos; capturas en ${output.absolutePath}."
}
