package mx.fastsolution.zenit.simulator

import com.nimbusds.jose.jwk.Curve

/**
 * Genera la clave del piloto como JWK P-256 privada y la imprime. Se corre a
 * mano una vez por ambiente (`gradlew :backend:pilotCardKey`) y se guarda en
 * el secreto pilot_card_key, fuera del repositorio.
 */
object PilotCardKeyGenerator {
    @JvmStatic
    fun main(args: Array<String>) {
        val key = com.nimbusds.jose.jwk.gen.ECKeyGenerator(Curve.P_256)
            .keyID("zenit-pilot-card-" + java.time.LocalDate.now())
            .generate()
        println(key.toJSONString())
    }
}
