package mx.fastsolution.zenit.mobile.location

data class CapturedLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val capturedAtEpochMillis: Long,
    val provider: String,
    val mock: Boolean,
)

