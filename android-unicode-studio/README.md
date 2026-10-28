# Unicode Studio

One standalone offline Android application containing all **81** existing Unicode programs:

| Versions | Samples per version | Total |
| --- | --- | --- |
| 1–11 | 1–3 | 33 |
| 12–15 | 1–12 | 48 |

The scrollable home screen selects Unicode 1–15. Each version opens its sample list. Back returns to that list, then the version selector; Home returns directly to the selector. Samples opens the current version's list. Backup exports/imports only the current sample's local state.

This separate project follows `android-studios`: Java Activity, Android WebView, Gradle 8.13 / Android Gradle Plugin 8.13, compile/target API 36 (Android 16), minimum API 26. It keeps status and navigation bars visible with system-bar insets and declines HTML fullscreen requests. The distinctive U-plus launcher icon is a vector resource. It uses the previous Unicode Studio application ID and signing certificate, version code 4 (version 2.0), so it can update the earlier installation while keeping the same per-sample origins.

`prepare-assets.py` enumerates the actual `sample*.html` files in every version folder, requires exactly samples 1–3 for versions 1–11 and samples 1–12 for versions 12–15 (81 total). Supporting runtime files are bundled locally. Original files are copied byte for byte; catalog metadata records original Program IDs and Storage Keys. Each sample has its own HTTPS origin (`unicode-V-S.appassets.androidplatform.net`), keeping even identical storage keys isolated. All requests are handled from APK assets; the manifest has no Internet permission. Source HTML is never rewritten. Native file-picker/download and backup helpers follow the previous working host.

## Build and verification

Run `./gradlew assembleRelease lintRelease assembleDebug assembleDebugAndroidTest` in this directory with JDK 21 and Android SDK 36 installed. Run `python3 verify-apk.py app/build/outputs/apk/release/app-release.apk` to compare all packaged original bytes with repository files and check complete sample coverage.

GitHub Actions workflow `.github/workflows/unicode-studio-1-15.yml` builds, runs lint and asset verification, then installs and launches on an Android 16 emulator with airplane mode enabled, Wi-Fi and mobile data disabled. Instrumentation clicks all version and sample buttons, checks original IDs/keys, separate origins, persisted local storage across navigation and process restart, and visible system bars after fullscreen requests. It tests both debug and the exact release APK. Only after those checks pass does the workflow upload an artifact and commit the new release to `android-distributions/unicode-studio-1-15-v2.apk` using a no-overwrite write. Old APKs and Android projects are retained.

As with the earlier repository builds, APKs use the repository's public test signing key. They are standalone, installable builds; production distribution should use a private release key.

## Previous verified release — 2026-10-28

[GitHub Actions run 40666514957](https://github.com/ae6820dc/9062/actions/runs/40666514957) succeeded. All 72 samples passed on Android 16 in airplane mode with Wi-Fi and mobile data disabled, across initial use, process restart, and installation of the actual release APK. Navigation, original IDs and keys, isolated persistent storage, and both visible system bars were checked. All 129 bundled original files matched repository bytes.

- APK: [`android-distributions/unicode-studio-1-15-40666514957-1.apk`](../android-distributions/unicode-studio-1-15-40666514957-1.apk)
- Size: **9,952,640 bytes**
- [Actions artifact](https://github.com/ae6820dc/9062/actions/runs/40666514957/artifacts/12806343083)
- [SHA-256](../android-distributions/unicode-studio-1-15-40666514957-1.apk.sha256)

## Complete Edition V2

V2 is a fresh GitHub Actions build of all 81 repository samples, including all twelve Unicode 12 samples. No Unicode HTML files were changed. The application architecture, launcher icon, interface, navigation, host helpers, Program IDs, Storage Keys and sample origins are preserved. `previous-apks.json` records every pre-V2 APK digest; verification rejects any change to those files. The package retains the public test signing certificate for in-place updates with `adb install -r`.

[Download the V2 APK](https://github.com/ae6820dc/9062/raw/refs/heads/main/android-distributions/unicode-studio-1-15-v2.apk). The workflow publishes this file and a GitHub Actions artifact only after lint, signature/package checks, byte-for-byte asset checks, and all 81 sample launch/navigation/storage/system-bar checks pass on an Android 16 emulator with networking disabled. The exact release is installed over the debug build and tested again. This is emulator verification; no physical device is claimed. The adjacent `.verification.txt` and `.sha256` files record package results, size and digest.
