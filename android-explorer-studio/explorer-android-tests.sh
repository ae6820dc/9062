#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
adb install -r android-explorer-studio/app/build/outputs/apk/explorer/debug/app-explorer-debug.apk
adb install -r -t android-explorer-studio/app/build/outputs/apk/androidTest/explorer/debug/app-explorer-debug-androidTest.apk
adb shell cmd connectivity airplane-mode enable
# Check the original light UI even with a dark Android system setting.
adb shell cmd uimode night yes
for phase in seed verify; do
  adb shell am force-stop io.github.ae6820dc.explorerstudio
  adb shell am instrument -w -e phase "$phase" io.github.ae6820dc.explorerstudio.test/io.github.ae6820dc.studio.ExplorerInstrumentation > "explorer-$phase.log"
  cat "explorer-$phase.log"
  if ! grep -q 'PASS ' "explorer-$phase.log" || grep -q FAIL "explorer-$phase.log"; then exit 1; fi
done
adb shell am force-stop io.github.ae6820dc.explorerstudio
adb shell am start -n io.github.ae6820dc.explorerstudio/io.github.ae6820dc.studio.MainActivity
adb exec-out screencap -p > explorer-home.png
