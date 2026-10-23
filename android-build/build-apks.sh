#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./gradlew --no-daemon assembleUnicode7Debug assembleUnicode9Debug lintUnicode7Debug lintUnicode9Debug
for edition in 7 9; do
  cp "app/build/outputs/apk/unicode${edition}/debug/app-unicode${edition}-debug.apk" "../unicode/${edition}/sample1.apk"
done
python3 verify-apks.py
