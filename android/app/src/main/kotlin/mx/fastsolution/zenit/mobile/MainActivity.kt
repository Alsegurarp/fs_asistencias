package mx.fastsolution.zenit.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity(), NfcAdapter.ReaderCallback {
    private val viewModel: AttendanceViewModel by viewModels()
    private val nfcAdapter: NfcAdapter? by lazy { NfcAdapter.getDefaultAdapter(this) }
    private var locationGranted by mutableStateOf(false)
    private var nfcReady by mutableStateOf(false)

    private val requestLocationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants -> locationGranted = grants.values.any { it } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        locationGranted = hasLocationPermission()
        setContent {
            val state by viewModel.state.collectAsStateWithLifecycle()
            val weekState by viewModel.weekState.collectAsStateWithLifecycle()
            OperationalScreen(
                state = state,
                weekState = weekState,
                onLoadWeek = viewModel::loadWeek,
                onAcknowledgeWeek = viewModel::acknowledgeWeek,
                onShareWeek = { report ->
                    startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_SUBJECT, "Mi registro semanal de asistencia")
                        putExtra(Intent.EXTRA_TEXT, report)
                    }, "Compartir mi resumen"))
                },
                onOpenPresentation = { startActivity(Intent(this, PresentationActivity::class.java)) },
                nfcAvailable = nfcReady,
                locationGranted = locationGranted,
                onActivate = viewModel::activate,
                onSynchronize = viewModel::synchronize,
                onRenewSession = viewModel::renewSession,
                onSelectType = viewModel::selectType,
                onRequestLocation = {
                    // Android 12+ ignora la solicitud si FINE se pide sin COARSE.
                    requestLocationPermission.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION,
                        ),
                    )
                },
            )
        }
    }

    override fun onResume() {
        super.onResume()
        locationGranted = hasLocationPermission()
        nfcReady = nfcAdapter?.isEnabled == true
        nfcAdapter?.enableReaderMode(
            this,
            this,
            NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_NFC_F or
                NfcAdapter.FLAG_READER_NFC_V or
                NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null,
        )
    }

    override fun onPause() {
        nfcAdapter?.disableReaderMode(this)
        nfcReady = false
        super.onPause()
    }

    override fun onTagDiscovered(tag: Tag) {
        viewModel.captureTag(tag.id)
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
}
