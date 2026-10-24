#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./gradlew --no-daemon assembleMathematicsDebug lintMathematicsDebug assembleUnicodeDebug lintUnicodeDebug
mkdir -p ../android-distributions
cp "app/build/outputs/apk/mathematics/debug/app-mathematics-debug.apk" "../android-distributions/mathematics-studio.apk"
cp "app/build/outputs/apk/unicode/debug/app-unicode-debug.apk" "../android-distributions/unicode-studio.apk"
python3 verify-apks.py
