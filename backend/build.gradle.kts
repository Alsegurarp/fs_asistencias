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

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-jooq")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
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

tasks.bootJar {
    archiveFileName.set("backend.jar")
}
