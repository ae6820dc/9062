#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
trap 'adb logcat -d -s AndroidRuntime chromium > runtime-logcat.txt; tail -100 runtime-logcat.txt' EXIT
adb shell cmd connectivity airplane-mode enable
adb shell svc wifi disable
adb shell svc data disable
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r -t app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
for phase in seed verify; do
 adb shell am force-stop io.github.ae6820dc.unicodestudio
 adb shell am instrument -w -e phase "$phase" io.github.ae6820dc.unicodestudio.test/io.github.ae6820dc.studio.SmokeInstrumentation | tee "runtime-$phase.txt"
 if ! grep -q 'PASS ' "runtime-$phase.txt" || grep -q 'FAIL' "runtime-$phase.txt"; then exit 1; fi
done
# Also install and launch the exact non-debuggable release artifact.
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am force-stop io.github.ae6820dc.unicodestudio
adb shell am instrument -w -e phase verify io.github.ae6820dc.unicodestudio.test/io.github.ae6820dc.studio.SmokeInstrumentation | tee runtime-release.txt
grep -q 'PASS ' runtime-release.txt
! grep -q 'FAIL' runtime-release.txt
