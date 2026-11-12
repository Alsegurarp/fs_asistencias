FROM ghcr.io/cirruslabs/android-sdk:36@sha256:f9b3ea9ed2b5fc9522adae82c7b4622ab7aa54207ef532c8e615a347dca08f31

WORKDIR /workspace

COPY . .

# bash con pipefail: el resultado de Gradle no se pierde al pasar por tee.
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Si la primera vuelta falla por la red (descargar Gradle, un plugin o una
# dependencia), se repite una sola vez. Una prueba o el lint que fallan no se
# repiten: la falla es del código. Si existe el reporte de lint, se muestra.
RUN --mount=type=cache,target=/root/.gradle,sharing=locked \
    --mount=type=cache,target=/root/.android,sharing=locked \
    chmod +x gradlew; \
    report=app/build/intermediates/lint_intermediate_text_report/debug/lintReportDebug/lint-results-debug.txt; \
    network='Could not (resolve|GET|HEAD|download|install Gradle distribution)|Connection reset|Connect timed out|Read timed out|Remote host terminated the handshake|Received status code (429|5[0-9][0-9])'; \
    for attempt in 1 2; do \
        ./gradlew --no-daemon testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest 2>&1 | tee /tmp/gradle.log && exit 0; \
        if [ "$attempt" = 1 ] && grep -qE "$network" /tmp/gradle.log; then \
            echo 'Falla de red al descargar; se repite una vez en 30 s.'; sleep 30; continue; \
        fi; \
        if [ -f "$report" ]; then cat "$report"; fi; \
        exit 1; \
    done
