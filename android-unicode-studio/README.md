# Unicode Studio

One standalone offline Android application containing all **72** existing Unicode programs:

| Versions | Samples per version | Total |
| --- | --- | --- |
| 1–12 | 1–3 | 36 |
| 13–15 | 1–12 | 36 |

The scrollable home screen selects Unicode 1–15. Each version opens its sample list. Back returns to that list, then the version selector; Home returns directly to the selector. Samples opens the current version's list. Backup exports/imports only the current sample's local state.

This separate project follows `android-studios`: Java Activity, Android WebView, Gradle 8.13 / Android Gradle Plugin 8.13, compile/target API 36 (Android 16), minimum API 26. It keeps status and navigation bars visible with system-bar insets and declines HTML fullscreen requests. The distinctive U-plus launcher icon is a vector resource. It uses the previous Unicode Studio application ID and signing certificate, version code 3, so it can update the earlier installation while keeping the same per-sample origins.

`prepare-assets.py` enumerates the actual `sample*.html` files in every version folder, requires at least the expected counts, and includes any extra samples automatically. Supporting runtime files are bundled locally. Original files are copied byte for byte; catalog metadata records original Program IDs and Storage Keys. Each sample has its own HTTPS origin (`unicode-V-S.appassets.androidplatform.net`), keeping even identical storage keys isolated. All requests are handled from APK assets; the manifest has no Internet permission. Source HTML is never rewritten. Native file-picker/download and backup helpers follow the previous working host.

## Build and verification

Run `./gradlew assembleRelease lintRelease assembleDebug assembleDebugAndroidTest` in this directory with JDK 21 and Android SDK 36 installed. Run `python3 verify-apk.py app/build/outputs/apk/release/app-release.apk` to compare all packaged original bytes with repository files and check complete sample coverage.

GitHub Actions workflow `.github/workflows/unicode-studio-1-15.yml` builds, runs lint and asset verification, then installs and launches on an Android 16 emulator with airplane mode enabled, Wi-Fi and mobile data disabled. Instrumentation clicks all version and sample buttons, checks original IDs/keys, separate origins, persisted local storage across navigation and process restart, and visible system bars after fullscreen requests. It tests both debug and the exact release APK. Only after those checks pass does the workflow upload an artifact and commit a uniquely named release to `android-distributions/unicode-studio-1-15-RUN_ID-ATTEMPT.apk`. Old APKs and Android projects are retained.

As with the earlier repository builds, APKs use the repository's public test signing key. They are standalone, installable builds; production distribution should use a private release key.
