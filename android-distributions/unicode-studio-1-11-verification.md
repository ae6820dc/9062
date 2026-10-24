# Unicode Studio 1–11 verification

Built 2026-10-24 from the existing Android Studio implementation. No original HTML, Program ID, storage key, host JavaScript, native activity, manifest, orientation behavior or icon source changed.

- File: `android-distributions/unicode-studio-1-11.apk`
- Application ID: `io.github.ae6820dc.unicodestudio`
- versionCode: **2**; versionName: **1.1**
- Size: **317,749 bytes**
- SHA-256: `90af555e75431ea823d2441ca4435c93aa92677b84fe3f3e14cd9320b35bc5d5`
- Programs: **33**, Unicode 1–11, three samples each, all bundled locally.
- Build: `assembleUnicodeRelease lintUnicodeRelease`, Gradle 8.13, AGP 8.13.0, Temurin JDK 21.0.8, Android SDK/build-tools 36. Successful; non-debuggable release configuration.
- Signer matches the previous APK: `01059a5e2a9f61d6b88aff4f2b47bc4e33195b352ba01872858f71fd358ffb1e`.

## Executed local checks

`ANDROID_HOME=... python3 android-studios/verify-apks.py` passed signature validation, package/version/API checks, ZIP integrity, absence of Internet permission, non-fullscreen theme, all 33 unique Program IDs, unique original storage keys, source byte comparisons, unchanged first 27 catalog entries, unchanged original host helper, and identical compiled launcher icon bytes. Release resource optimization renames the icon's internal APK path without changing its bytes.

`python3 android-studios/package-browser-tests.py --unicode-only` passed against the actual APK-extracted assets. All 33 programs launched without page errors at isolated local HTTPS origins. Checks covered original settings after reload/switching, host backup exports and storage restoration for every program, complete Program IDs without horizontal clipping at 320×740, 740×320, 800×1280 and 1280×800, and no external requests. Each of the six added programs passed motion checks for all 28 character sets: 168 direction checks in total. Unicode 10 moved left to right; Unicode 11 moved right to left. All 33 source HTML files match baseline commit `d19b207940dbb30cd7d69d395ea27d9af604b6b8` exactly.

These browser checks do not establish Android system-bar visibility or native update persistence. The GitHub Actions Android suite additionally checks the actual Programs dialog count, every program's launch, visible system bars and inset geometry, airplane-mode operation, portrait/landscape persistence, all added animation directions, and native backup import confirmation/restoration through a cache-file URI. It seeds the old APK, installs the actual new release with `adb install -r`, and checks preservation of all 27 previous origins. The successful Android CI result is recorded below.

## Previous APK preservation

All four previous APKs remain at their original paths, byte-identical:

| File | SHA-256 |
| --- | --- |
| `android-distributions/unicode-studio.apk` | `38da794ec263900b5836d745bf1a110e8e3aa050e6f2e5947f46a30882876018` |
| `android-distributions/mathematics-studio.apk` | `dca33cdb3cdaa345f85b5e7235007d4963e1718e083bd5af1c78d6b8aed2b9d3` |
| `unicode/7/sample1.apk` | `cfc50eea1afeee7e80edd18ae93ccf092567c0c87a24b930aa32756d32042525` |
| `unicode/9/sample1.apk` | `9604dafca7da510ab667d2f2ee246565a4191bcab5c4e5859f02441918281ce7` |

The build script retains existing output files and requires a new filename for any later release. CI stages only the new versioned Unicode APK and checksum manifest. No signing material was added or changed.

## Signing and test limitations

The existing identity is a public test key already tracked by the repository. No private production signing identity is configured. This release is signed and compatible with the old application's certificate, but should not be described as having private production signing security. Install over the existing app; do not uninstall or clear data.

No local Android runtime result is claimed: this environment has no `/dev/kvm`. No physical device, Android tablet, pre-API-36 runtime, or Android document-provider file-picker round trip has been tested. Browser backup coverage exercises the export payload and restoration algorithm; the native import test uses a local cache URI rather than a document provider.

## Successful Android 16 CI run

[Android Studios run 40133396565](https://github.com/ae6820dc/9062/actions/runs/40133396565) passed both `build` and `android-runtime` jobs, testing source commit `fb40c6dceeb8b73a368491585c678fc43ac19ef9` and the exact published release APK above.

- Previous Unicode 1–9 APK: **218 checks** passed while seeding and verifying its 27 origins.
- Actual release installed over the old APK with `adb install -r`: **301 checks** passed, including preservation of all 27 old origin markers and successful launches of all 33 programs.
- New process in landscape: **307 checks** passed across all 33 programs.
- **826 Unicode Android checks** in total. The existing Mathematics Studio regression also passed 91 and 101 checks; its distributed APK remained unchanged.
- The actual Programs dialog adapter contained the expected count and every original label: 27 before upgrade, exactly 33 afterward.
- Every program displayed its complete original ID text, loaded over an isolated local HTTPS origin in airplane mode, preserved state across reload/switching, and had both status/navigation bars visible with WebView bounds inside their insets in portrait and landscape.
- All 28 character sets in every Unicode 10 and 11 sample passed movement checks using their actual Start/Stop controls and rendered DOM transforms in both release phases. Internal animation variables are not used by the final Android test.
- Native import accepted the original backup schema, displayed its confirmation, restored the cache-file backup, reloaded the program and retained its isolated state in both release phases. The document-provider picker itself remains outside this automated coverage.

Earlier test attempts exposed assumptions in the new test harness (accessibility collection metadata and manual inspection of animation variables); those checks were replaced with direct dialog-adapter inspection and actual rendered-motion checks. No application HTML, host, native activity or published APK was changed during these test corrections.

Both old and new raw GitHub download URLs were fetched independently and matched their expected SHA-256 values. Only one APK was added to the repository; no previous APK was changed, renamed or removed.
