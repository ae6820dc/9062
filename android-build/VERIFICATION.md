# Verification results — version 1.1 (versionCode 2)

Verified 2026-10-24. Both original `unicode/7/sample1.html` and `unicode/9/sample1.html` remain unchanged. Changes are confined to the separate Android project and its two existing APK output paths.

## Build and package verification

Gradle 8.13, Android Gradle Plugin 8.13.0, Temurin JDK 21.0.8, compile/target API 36, build-tools 36.0.0. `build-apks.sh` completed both assemble tasks, both lint tasks, and `verify-apks.py`. Each lint report has zero errors and two existing warnings (required JavaScript and backup configuration).

| APK | Application ID | versionCode | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `unicode/7/sample1.apk` | `io.github.ae6820dc.unicode71` | 2 | 22036 | `cfc50eea1afeee7e80edd18ae93ccf092567c0c87a24b930aa32756d32042525` |
| `unicode/9/sample1.apk` | `io.github.ae6820dc.unicode91` | 2 | 22436 | `9604dafca7da510ab667d2f2ee246565a4191bcab5c4e5859f02441918281ce7` |

Both APKs pass `apksigner verify` (v2 signatures). Their signing certificate SHA-256 exactly matches both original versionCode 1 APKs: `01059a5e2a9f61d6b88aff4f2b47bc4e33195b352ba01872858f71fd358ffb1e`. The existing public test signing key is retained. These remain test-signed debug applications.

`aapt` verifies distinct unchanged package IDs, labels, minSdk 26, targetSdk 36, versionCode 2, launcher activities, and a non-fullscreen theme. Neither APK requests internet permission. ZIP validation passes and each packaged HTML asset matches its repository source byte for byte. The stable `https://app.local/sample1.html` origin, JavaScript, DOM Storage, storage keys, and save behavior are preserved. No cache/storage clearing or data migration is introduced.

## Program ID investigation and browser regression checks

Exact original values:

- Unicode 7.1: `D8A74F20C91B6E35A0D27C4F8E13B569`
- Unicode 9.1: `A93F7C12D4E860B5F1A29C7D830E6B42`

The original assets contain all 32 characters; packaging does not drop or replace any characters. The original CSS already allows wrapping and gives the header no fixed height or hidden overflow. The reported missing-middle defect could not be reproduced in local Chromium at 320 pixels, so a specific device/font/WebView defect is not established. The host now supplies a header-only rendering adjustment: monospace without ligatures, explicit line height and wrapping, no height limit or hidden overflow, and 100% text scaling. It never inserts, replaces, or reconstructs ID text. This is a rendering mitigation, not proof of the original device-specific root cause.

`layout-check.py` passed for both apps at 240×640, 280×640, 320×640, 360×800, 640×320, 800×1280, and 1280×800 CSS pixels. It executes the exact host-injected JavaScript against the unchanged HTML, compares the complete header with the original ID, and verifies that every hexadecimal character has a positive layout box contained within the header. It also verifies controls, search, animation, and localStorage persistence after reload using locally fulfilled resources. These are Chromium browser checks, not Android device tests.

## Android system bars and storage

The old host unconditionally hid system bars on create, resume, focus, and fullscreen exit, and its theme requested fullscreen. The new host shows both bars normally and applies system-bar, cutout, and IME insets to the root container, including Android 16 edge-to-edge windows. Only an active HTML-requested WebChromeClient custom view hides system bars. Exiting that view restores both bars. The native WebView host has no Chrome toolbar or address bar.

Runtime testing results are recorded below. No physical-device testing was performed.

## Emulator attempt and remaining limits

An Android 16 / API 36 AOSP x86_64 emulator (Emulator 37.2.12, WebView 133.0.6943.137) was started with software CPU emulation (`-accel off`) and SwiftShader. This workspace has no `/dev/kvm`. Android eventually reported `sys.boot_completed=1`. Installing the original Unicode 7.1 APK returned `Success`, and its process and WebView debug socket were observed. However, the Android system displayed **“Process system isn't responding”** and the WebView debug HTTP endpoint did not respond. The attempted old-version-to-new-version smoke run was stopped before it could seed and compare saved state. This is not a passing runtime test of the updated APKs.

Consequently, updated-APK installation, simultaneous installation, actual system-bar/inset geometry, fullscreen entry/exit, Android offline interaction, in-place-update data retention, rotation/tablet behavior on Android, and reboot persistence remain **unverified at runtime**. Package IDs/certificates/origin/storage code support compatible in-place updates, but that does not substitute for a successful device test. No physical device was tested. Browser phone/tablet checks are reported separately above.

To repeat on a responsive dedicated emulator:

```sh
ANDROID_HOME=/path/to/sdk BASELINE_APK_DIR=/path/to/original-apks python3 android-build/emulator-smoke.py
```

The baseline directory must contain original `7.apk` and `9.apk` from the preceding repository version. The script installs with `adb install -r` and never clears app data. It modifies preferences only in the dedicated test emulator. Omit `BASELINE_APK_DIR` for tests without a version-1 baseline. `--skip-reboot` omits reboot testing.
