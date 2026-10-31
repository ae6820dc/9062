# Hexic 2048
Standalone offline Android APK of hexic2048/13/sample1.html.
Package: io.github.ae6820dc.hexic2048v13. Android 8+ with a current Android System WebView; targets Android 16.
The bundled HTML forces the existing dark theme, including Program ID, manual Save game, all grids, modes and save slots.
JavaScript dialogs and native score sharing are supported. No network permission.
Build: ANDROID_HOME=/path/to/sdk bash build-sdk.sh (JDK and Android SDK platform/build-tools 36 required).
GitHub Actions verifies the signature and runs the app offline on Android 16.
Output: android-distributions/Hexic-2048.apk.

Version code 2; same package, signer and storage as the first APK. Updates preserve saved games. The workflow verifies a seeded save through an APK update and checks dark mode with the system in light mode.
