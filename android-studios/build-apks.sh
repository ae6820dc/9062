#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
output=../android-distributions/unicode-studio-1-11.apk
# Published APKs are immutable. A later release must use a new filename.
if [[ -e "$output" ]]; then
  echo "Existing release retained: $output"
else
  ./gradlew --no-daemon assembleUnicodeRelease lintUnicodeRelease
  mkdir -p ../android-distributions
  (set -o noclobber; cat app/build/outputs/apk/unicode/release/app-unicode-release.apk > "$output")
fi
python3 verify-apks.py
