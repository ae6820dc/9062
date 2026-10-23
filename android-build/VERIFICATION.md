# Verification results

Initial local verification: 2026-10-23.

- Gradle 8.13 wrapper with JDK 21: both `assembleUnicode7Debug`, `assembleUnicode9Debug`, `lintUnicode7Debug`, and `lintUnicode9Debug` passed. Lint has zero errors; warnings concern required JavaScript and Android backup configuration.
- `apksigner verify`: both APKs pass APK Signature Scheme v2 verification with the same preserved RSA 3072-bit test certificate.
- `aapt`: distinct IDs, separate labels and icons, minSdk 26, targetSdk 36, launcher activities, fullscreen theme, no internet permission.
- APK assets match the repository HTML byte for byte. DEX includes JavaScript and DOM Storage setup using a stable offline HTTPS origin.
- Neither original HTML file was modified. No other Unicode version or unrelated application was modified.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `unicode/7/sample1.apk` | 23934 | `d1ed339ee82a6dfbd09bea0b8ed3ad6571b4f78ce6b49d10b0cd152a3efe155a` |
| `unicode/9/sample1.apk` | 24332 | `eb652128337f6f132e88e9d779de508d2218c8256db262185d8558a012ad8395` |

Signing certificate SHA-256: `01059a5e2a9f61d6b88aff4f2b47bc4e33195b352ba01872858f71fd358ffb1e`. These are test-signed debug APKs, not production releases. The public test key is preserved in the project for compatible test updates.

## Runtime tests

An Android 16 / API 36 AOSP x86_64 emulator was started with Android Emulator 37.2.12, `-accel off`, and SwiftShader. ADB confirmed Android release 16 and SDK 36. This workspace has no `/dev/kvm`; `emulator -accel-check` reports `KVM requires a CPU that supports vmx or svm`.

The emulator remained in first-boot compilation/startup. Its package manager rejected the installation attempt with `Error: device is still booting.` Installation, simultaneous installation, launch, interactive controls, and runtime persistence tests therefore **did not complete**. This is an emulator startup limitation, not a successful install test or an APK signature/package rejection. No physical-device or device-reboot test was performed. Persistent storage and fullscreen configuration were verified in source and packaged APK metadata; their runtime behavior is not claimed as emulator-tested.

Both uploaded APKs were downloaded again from GitHub and compared byte for byte with the locally verified APKs. The full `build-apks.sh` script completed successfully. The GitHub Actions workflow is committed; a hosted workflow run was not observed during this session.

To repeat the optional runtime test on a dedicated booted emulator, install `websocket-client`, set `ANDROID_HOME`, and run `python3 android-build/emulator-smoke.py`. It installs both APKs without clearing data, enables airplane mode, changes app settings for the test, exercises controls and Back/fullscreen, force-stops/relaunches, and reboots to check saved state.

The smoke script accepts `--skip-install` for previously installed packages and `--skip-reboot` to omit reboot testing. It checks that the connected target is an emulator before changing settings.
