FROM ghcr.io/cirruslabs/android-sdk:36@sha256:f9b3ea9ed2b5fc9522adae82c7b4622ab7aa54207ef532c8e615a347dca08f31

WORKDIR /workspace

COPY . .

RUN --mount=type=cache,target=/root/.gradle \
    --mount=type=cache,target=/root/.android \
    chmod +x gradlew \
    && (./gradlew --no-daemon testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest \
        || { cat app/build/intermediates/lint_intermediate_text_report/debug/lintReportDebug/lint-results-debug.txt; exit 1; })
