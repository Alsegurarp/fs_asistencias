package mx.fastsolution.zenit.mobile.capture

import java.time.Duration
import java.time.Instant

object SessionPolicy {
    fun usable(startedAt: Instant, now: Instant, maxAgeHours: Long, nextSequence: Int, maxEvents: Int): Boolean =
        maxAgeHours > 0 && nextSequence in 1..maxEvents &&
            now >= startedAt.minusSeconds(60) && now < startedAt.plus(Duration.ofHours(maxAgeHours))
}
