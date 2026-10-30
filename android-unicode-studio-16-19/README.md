# Unicode Studio 16–19

Reuses the Unicode Studio V2 Android Activity, WebView configuration, native menus, toolbar, icon, offline origins and host helpers. Only versions 16–19 are included. The asset generator discovers every sample*.html and copies original bytes without changes. No README files are bundled. The app has a distinct application ID, visible system bars and the name Unicode Studio 16–19.

The dedicated GitHub Actions workflow builds the signed debug APK, runs lint and verifies original bytes, signature and preservation of previous APKs. Android 16 instrumentation opens every discovered sample offline, checks original Program IDs and storage keys, navigation, persistent isolated storage and visible status/navigation bars.
