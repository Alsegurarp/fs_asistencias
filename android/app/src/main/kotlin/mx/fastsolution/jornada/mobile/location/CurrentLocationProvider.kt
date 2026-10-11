package mx.fastsolution.jornada.mobile.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class CurrentLocationProvider(
    private val context: Context,
) {
    private val client = LocationServices.getFusedLocationProviderClient(context)

    suspend fun capture(): CapturedLocation? {
        val hasLocationPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
        if (!hasLocationPermission) return null

        val request = CurrentLocationRequest.Builder()
            .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
            .setDurationMillis(10_000)
            .setMaxUpdateAgeMillis(0)
            .build()

        return suspendCoroutine { continuation ->
            client.getCurrentLocation(request, null)
                .addOnSuccessListener { location ->
                    continuation.resume(
                        location?.let {
                            CapturedLocation(
                                latitude = it.latitude,
                                longitude = it.longitude,
                                accuracyMeters = it.accuracy,
                            )
                        },
                    )
                }
                .addOnFailureListener { continuation.resume(null) }
        }
    }
}

