package mx.fastsolution.zenit.mobile

import android.Manifest
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat

/** Isolated presentation: no repositories, capture reader or synchronization workers. */
class PresentationActivity : ComponentActivity() {
    private var locationGranted by mutableStateOf(false)
    private var nfcReady by mutableStateOf(false)
    private val requestLocation = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        locationGranted = it.values.any { granted -> granted }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ProductApp(
                activation = ActivationUiState(), pendingCount = 0, onActivate = { _, _ -> },
                nfcReady = nfcReady, locationGranted = locationGranted,
                onRequestLocation = {
                    requestLocation.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                },
            )
        }
    }

    override fun onResume() {
        super.onResume()
        locationGranted = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            .any { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }
        nfcReady = NfcAdapter.getDefaultAdapter(this)?.isEnabled == true
    }
}
