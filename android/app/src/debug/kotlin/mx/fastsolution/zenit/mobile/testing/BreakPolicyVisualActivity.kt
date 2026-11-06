package mx.fastsolution.zenit.mobile.testing

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import java.time.Instant
import kotlinx.coroutines.launch
import mx.fastsolution.zenit.mobile.CaptureUiState
import mx.fastsolution.zenit.mobile.OperationalScreen
import mx.fastsolution.zenit.mobile.PersonalWeekState
import mx.fastsolution.zenit.mobile.capture.BreakPolicySchedule
import mx.fastsolution.zenit.mobile.data.AttendanceRepository
import org.json.JSONObject

/** Pantalla real con sesión ficticia en memoria; no abre el almacén ni programa sincronizaciones. */
class BreakPolicyVisualActivity : ComponentActivity() {
    var selectedType: String? = null
        private set
    var uiState by mutableStateOf(CaptureUiState())
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val current = checkNotNull(intent.getStringExtra("current"))
        val upcoming = checkNotNull(intent.getStringExtra("upcoming"))
        check(current in BreakPolicySchedule.POLICIES && upcoming in BreakPolicySchedule.POLICIES)
        val deadline = Instant.parse(intent.getStringExtra("effectiveAt"))
        val session = JSONObject().put("breakPolicy", current).put("upcomingBreakPolicy", JSONObject()
            .put("breakPolicy", upcoming).put("effectiveOn", "2026-11-16").put("effectiveAt", deadline.toString()))
        uiState = CaptureUiState(registered = true, personal = true, sessionUsable = true,
            deviceLabel = "QA visual ficticia · sesión sólo en memoria", serverUrl = "http://127.0.0.1:1", message = "")
        setContent {
            OperationalScreen(uiState, PersonalWeekState(), {}, { _, _, _ -> }, {},
                nfcAvailable = false, locationGranted = false, onRequestLocation = {},
                onActivate = { _, _, _ -> }, onSynchronize = {}, onRenewSession = {},
                onSelectType = { selectedType = it }, onOpenPresentation = {})
        }
        lifecycleScope.launch {
            BreakPolicySchedule.updates(deadline).collect {
                val now = Instant.now()
                uiState = uiState.copy(breakPolicy = AttendanceRepository.breakPolicyAt(session, now),
                    breakPolicyNotice = AttendanceRepository.breakPolicyNotice(session, now))
            }
        }
    }
}
