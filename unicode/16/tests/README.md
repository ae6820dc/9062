# Unicode 16 browser validation

From the repository root, serve `python -m http.server 8765`, then run
`node unicode/16/tests/browser.cjs` with Playwright available. Set `CHROMIUM_PATH`
if Chromium is not at `/usr/bin/chromium`.

Verified on 2026-10-30 in headless Chromium for all three samples:

- All nine ABC length-two strings, exact order; duplicate removal and sorting.
- First/last bounds, no wrapping, direct jumps and previous/next agreement.
- Exact positions 9007199254740993 and 9007199254740994.
- Full browser Unicode alphabet at length 128, including the exact last string.
- Supplementary code points, 128 code-point entries in the separate panel.
- Invalid decimals, out-of-range input, corrupt saved state, and paused restoration.
- Real timed playback, jump dialog, and fullscreen entry/exit.
- No horizontal page overflow at 320×568 and 1440×1000; 112px code-point panel.
- Six unique 16-digit hexadecimal identities; samples otherwise byte-identical.
- No JavaScript browser errors.

The browser determines the Unicode alphabet; this validation does not certify
font coverage, other browser engines, or physical mobile devices.
