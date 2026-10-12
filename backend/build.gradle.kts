plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

kotlin {
    compilerOptions {
        freeCompilerArgs.add("-Xjsr305=strict")
    }
}

// Versiones que se adelantan a las que trae Spring Boot 4.1.1, porque las suyas
// tienen vulnerabilidades ya corregidas: Tomcat embebido 11.0.24 (críticas) y
// Jackson 3.1.5 (altas). Se retiran cuando una versión de Spring Boot traiga
// estas o más nuevas; el análisis de vulnerabilidades lo dirá.
extra["tomcat.version"] = "11.0.26"
extra["jackson-bom.version"] = "3.1.7"

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-jooq")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    runtimeOnly("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation(kotlin("test"))
    // Comprueba en las pruebas que cada respuesta cumple el esquema del contrato.
    testImplementation("com.networknt:json-schema-validator:3.0.8")
}

// Las pruebas unitarias corren en cada build. Las de integración necesitan una
// base PostgreSQL real y se corren aparte, con docker compose.
tasks.test {
    useJUnitPlatform {
        excludeTags("integration")
    }
}

tasks.register<Test>("integrationTest") {
    description = "Pruebas contra una base PostgreSQL real."
    group = "verification"
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform {
        includeTags("integration")
    }
    // Deja a la vista qué se probó: dependen de una base externa.
    testLogging {
        events("passed", "failed", "skipped")
        // Con el motivo de cada falla, sin la traza: dice qué respuesta no cumplió y por qué.
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        showStackTraces = false
    }
    // El contrato es parte de lo que se prueba: cada respuesta se valida contra su esquema,
    // y la prueba que revisa que no quedó operación sin ejercitar corre al final.
    systemProperty("junit.jupiter.testclass.order.default", "org.junit.jupiter.api.ClassOrderer\$OrderAnnotation")
    val contract = rootProject.layout.projectDirectory.file("contracts/openapi.yaml")
    inputs.file(contract)
    systemProperty("zenit.contract", contract.asFile.absolutePath)
    shouldRunAfter(tasks.test)
}

// Simulador de dispositivo para el entorno local. Vive en su propio conjunto de
// fuentes: usa las mismas bibliotecas que el backend, pero no entra al artefacto
// que se despliega ni a las pruebas.
val simulator: SourceSet by sourceSets.creating
configurations[simulator.implementationConfigurationName].extendsFrom(configurations.implementation.get())
configurations[simulator.runtimeOnlyConfigurationName].extendsFrom(configurations.runtimeOnly.get())

tasks.register<JavaExec>("simulate") {
    description = "Activa dispositivos simulados y manda marcajes firmados al backend local."
    group = "application"
    classpath = simulator.runtimeClasspath
    mainClass.set("mx.fastsolution.zenit.simulator.DeviceSimulatorKt")
}

tasks.bootJar {
    archiveFileName.set("backend.jar")
}
