# Android debug build verification

Executed 2026-10-24. Local build: Temurin JDK 21.0.8, Gradle 8.13, Android Gradle Plugin 8.13.0, SDK/target 36, minSdk 26, build-tools 36.0.0.

Both repositories retain all original application HTML, JavaScript, CSS, Program IDs, storage keys, indexes and existing APKs. The Android projects, workflows and separate distribution directories are additions. No Factorial Studio code is included or changed.

## Build and packaged assets

All three application assemble and lint tasks passed locally. The table records the delivered CI-built APKs (Temurin JDK 21.0.12); these were downloaded from the committed repository paths and reverified locally. Their original assets and host helper script are byte-identical to the locally tested assets, although compiler/compression differences produce different APK hashes from the initial local JDK 21.0.8 builds. All three native test APKs also compiled. `verify-apks.py` passed ZIP integrity, apksigner v2 signature validation, package IDs, versionCode, API levels, non-fullscreen theme, absence of internet permission, original Program ID catalog uniqueness, and SHA-256/byte comparisons of every source asset with the APK. Signing uses the existing public test certificate SHA-256 `01059a5e2a9f61d6b88aff4f2b47bc4e33195b352ba01872858f71fd358ffb1e`. These are debug builds, not private-key production releases.

| APK | Package | versionCode | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `android-distributions/mathematics-studio.apk` | `io.github.ae6820dc.mathematicsstudio` | 1 | 1453041 | `dca33cdb3cdaa345f85b5e7235007d4963e1718e083bd5af1c78d6b8aed2b9d3` |
| `android-distributions/unicode-studio.apk` | `io.github.ae6820dc.unicodestudio` | 1 | 282502 | `38da794ec263900b5836d745bf1a110e8e3aa050e6f2e5947f46a30882876018` |

The source catalog and original storage keys are recorded in `android-distributions/programs.json`. Mathematics Studio includes all five families in both editions (10 programs, 116 original resource files). Unicode Studio includes versions 1–9 with all three samples (27 programs). Credit Chess includes 34 original resources, including the actual Stockfish JS/WASM, chess.js, licenses and corresponding-source archive. Gzip assets are stored with an internal `.bin` suffix so AAPT does not decompress them; their original request URLs are mapped to the unchanged bytes.

## Executed browser and engine regression tests

- Original calculator engine suite: 22 algorithm groups passed.
- Studio II mathematical suite: 11 groups passed.
- Original calculator browser suite: 154 checks passed.
- Studio II browser suite: 253 checks passed.
- Credit Chess unit suite: 50 tests passed.
- Credit Chess browser suite: 113 tests passed, including real Stockfish moves, Arena operation/Pause/Stop, accounts, balances, clocks, history, backup/recovery, entry switching and responsive Desktop/Tablet layouts.
- `package-browser-tests.py` passed against the actual APK-extracted assets: 37 Mathematics/Unicode programs and Credit Chess. Each program uses an isolated local HTTPS origin (Desktop/Tablet share the intended Chess origin). Checks include original ID display, local resources, workers for actual calculator calculations, original backup export through the host download shim, isolated state and restored calculation history/Unicode controls after switching and reload, and page widths 320×740, 740×320, 800×1280 and 1280×800 without horizontal overflow.
- Packaged Stockfish WASM initialized at the isolated HTTPS origin, reported Elo range 1320–3190, and returned four moves checked with the real chess.js legal-move implementation. No external resource requests were allowed in that test. Service workers were blocked in this browser harness so every requested runtime file had to come from the extracted APK assets.

These browser tests are not Android device tests. In particular, a locally served HTTPS browser proof does not establish that Android's request interception successfully serves every Web Worker/WASM request; the native instrumentation suite tests that separately.

## Local Android 16 attempt

An API 36 AOSP x86_64 emulator (Emulator 37.2.12, WebView 133.0.6943.137) booted with software CPU emulation and SwiftShader. There is no `/dev/kvm` in this workspace. The three application packages installed successfully and `pm list packages` confirmed that all three coexist, along with the previous Unicode 7.1 APK. The Mathematics Studio instrumentation APK also installed.

The native smoke run did **not** pass. Its output was `INSTRUMENTATION_RESULT: shortMsg=Process crashed.` The crash log records SIGTRAP inside `libwebviewchromium.so` during Mathematics Studio startup. A subsequent ordinary Unicode Studio launch timed out and a screenshot showed Android's “Process system isn't responding” dialog. The cause was not isolated to the emulator or wrapper. No successful Android startup, content rendering, navigation, system-bar/inset geometry, file picker/download roundtrip, application restart persistence, Stockfish WASM operation, Arena operation, or rotation/tablet behavior is claimed from this attempt. No physical device was tested.

The KVM-enabled GitHub Actions job builds and runs the included native instrumentation suite. It tests airplane-mode requests, origin isolation, switching/reload/restart persistence, Program IDs, calculator workers, Stockfish WASM, and system-bar/inset geometry in portrait and landscape. Its result must be inspected before treating Android runtime verification as complete; the presence of that job is not a passing result.

## Migration and installation

The HTML readmes document browser export/import for calculators and Chess using their original validated backup controls. A browser-console export snippet handles Unicode versions 1–9, with explicit confirmation before native import. The native localStorage backup is scoped to one program and never substitutes for Credit Chess's full IndexedDB backup. New package IDs do not read or overwrite old browser/APK data. Existing APK paths are untouched. Compatible future signed updates should use `adb install -r` and a higher versionCode; never uninstall to preserve data.

## Successful KVM-backed Android verification

The later GitHub Actions Android 16 run succeeded: [Android Studios run 40089486267](https://github.com/ae6820dc/9062/actions/runs/40089486267). Both `build` and `android-runtime` jobs passed. This supersedes the local software-emulator limitation for the checks actually executed below; it does not claim a successful local emulator or physical-device test.

- Mathematics Studio: 90 checks in the portrait seed process and 100 in a fresh landscape verification process (190 total).
- Unicode Studio: 216 checks in the portrait seed process and 243 in a fresh landscape verification process (459 total).
- All 37 catalog entries loaded from their isolated HTTPS origins in airplane mode, displayed their original Program IDs, and retained per-program state markers across reload, switching and separate instrumentation processes.
- All 10 calculator entries executed an actual offline Web Worker calculation and displayed a result without an error.
- Native window insets reported both status and navigation bars visible for every entry, and actual WebView bounds stayed between those system bars in portrait and landscape.
- The native host switching methods were exercised directly by instrumentation; toolbar menu touch hit targets and file-picker/download roundtrips were not automated.

The binary commit is [2e34473bc7612883cc9826b181b936f96ee36daa](https://github.com/ae6820dc/9062/commit/2e34473bc7612883cc9826b181b936f96ee36daa). Both actual APKs were downloaded from this commit, compared with the committed checksums, passed apksigner and source-asset verification again, and passed the APK-extracted browser suite again. No old Unicode APK path was replaced. Factorial edits elsewhere in repository history were concurrent upstream changes; none of the Android Studio implementation commits modify Factorial files.

Remaining limits: no physical device, Android tablet emulator, pre-API-36 runtime, or Android document-provider export/import roundtrip was tested. Tablet/phone responsive coverage is from the separately reported browser suites. Credit Chess's independent native results are recorded in the chess repository; they must not be inferred from this successful two-app run.

## Unicode Studio 1–11 update

The new versioned APK and its current verification results are documented separately in [Unicode Studio 1–11 verification](../android-distributions/unicode-studio-1-11-verification.md). The original APKs and the earlier results above remain historical records.
