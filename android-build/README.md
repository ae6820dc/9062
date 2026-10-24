# Unicode offline Android applications

Two independent native Android WebView applications, built from the unmodified repository HTML files:

| Name | Application ID | Repository APK |
| --- | --- | --- |
| Unicode 7.1 | `io.github.ae6820dc.unicode71` | `unicode/7/sample1.apk` |
| Unicode 9.1 | `io.github.ae6820dc.unicode91` | `unicode/9/sample1.apk` |

Android 8.0+ (API 26), compile/target API 36 (Android 16). No internet permission or remote dependencies at runtime. All application HTML, JavaScript, styles, and favicon are embedded in each APK. Character fonts come from Android; glyph availability depends on the installed system fonts, as with the original browser application.

## Build

Install JDK 21 and the Android SDK, accept its licenses, and install `platforms;android-36` and `build-tools;36.0.0`. Set `ANDROID_HOME` to your SDK directory, then run:

```sh
android-build/build-apks.sh
```

The checked-in Gradle wrapper selects Gradle 8.13; Android Gradle Plugin is pinned to 8.13.0. Initial build downloads require internet access; installed applications do not. The script builds and lints both flavors, copies the signed APKs into the required repository paths, and verifies their signatures, package IDs, manifests, and byte-for-byte HTML assets. To build without copying outputs, use `./gradlew assembleUnicode7Debug assembleUnicode9Debug` inside this directory.

The `Unicode Android APKs` GitHub Actions workflow builds both applications when their source or Android configuration changes, or when manually dispatched. It uploads convenience artifacts and also commits actual APK binaries to the same branch. Repository Actions settings must permit write access; protected branches may require an authorized branch/PR. It never force pushes. Bot-generated APK-only commits do not match workflow path filters.

## Test signing and updates

These initial APKs are **debug builds for testing**, signed with `signing/unicode-test.jks`, alias `unicode-test`, store/key password `android`. This deliberately public test key is checked in so local and CI builds retain the same signing certificate. Never use this public key for a production or sensitive application. Keep this exact key and application IDs to install future test builds over existing installations with `adb install -r`; increment `versionCode` for subsequent releases. Replacing the key prevents in-place updates. Do not uninstall to update if you want to retain saved data. A future production signing strategy should use a private protected keystore and separate production IDs or an explicitly planned migration.

## Storage and behavior

The WebView serves `https://app.local/sample1.html` from APK assets using request interception. This origin is stable across updates. JavaScript and DOM Storage are enabled. Each application has a separate Android UID/data directory and its own WebView localStorage database; the shared origin name cannot share data across apps. No storage-clearing APIs or access to Chrome/PWA data are used. Existing Chrome/PWA data is neither imported nor modified.

The original Program IDs and 16-character storage keys are preserved verbatim. After the page loads, the Android host injects a header-only style for monospace rendering, explicit line height, unrestricted wrapping and visible overflow; it never rewrites header text. The original HTML assets remain byte-identical to the repository sources. Version 1.1 uses versionCode 2. HTML saves its own state on interaction; the host also invokes the existing `save()` function on pause. Storage survives normal closure, process recreation, and device restart. Android's Clear storage and uninstall explicitly remove app data; backup is disabled. The host does not change the original HTML's behavior concerning resuming animation.

The activity has no action bar, browser menus, or address bar, and shows Android status and navigation bars by default. The root container applies system-bar, display-cutout, and keyboard insets on Android 16 and earlier supported versions, including orientation changes. System bars hide only while an HTML-requested custom fullscreen view is active, and return when it closes. WebChromeClient supports the original screen element's Fullscreen API. Back exits element fullscreen, closes the HTML search overlay, navigates WebView history if present, or backgrounds the task. It never deletes saved data. Android 13+ uses the modern back callback.

## Verification

Run `python3 android-build/verify-apks.py` with `ANDROID_HOME` set after building. See `VERIFICATION.md` for the actual build and runtime test results for the latest update. An emulator test is not physical-device verification.

Run `python3 android-build/layout-check.py` with Playwright and Chromium installed for per-character header geometry checks at seven phone/tablet viewport sizes. This is a browser regression check, not an Android runtime test.

For a version 1 → 2 data-retention test on a dedicated emulator, save the old repository APKs as `7.apk` and `9.apk` outside the repository and set `BASELINE_APK_DIR` to that directory when running `emulator-smoke.py`. It seeds state in the old version, installs the update with `adb install -r`, and compares the original localStorage value before exercising the updated app.
