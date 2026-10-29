# Unicode Translate — validated release

Validated on 2026-10-29 with Python 3.12.14, Node 24.19.0, Playwright 1.56.1 and Chromium 154.0.8037.57. Changes are confined to `translate/`. No APK was built.

## Bundled coverage

| Language | Distinct source headwords | Gap to 100,000 |
| --- | ---: | ---: |
| Hungarian | 142,513 | 0 |
| English | 211,086 | 0 |
| German | 25,626 | 74,374 |
| French | 56,399 | 43,601 |
| Spanish | 90,495 | 9,505 |
| Italian | 50,272 | 49,728 |
| Russian | 25,185 | 74,815 |
| Japanese | 385,819 | 0 |
| Latin | 9,085 | 90,915 |

Total: **996,480 distinct language-specific headwords**, **1,374,723 indexed lookup forms** (including complete reverse phrases), and **1,001,282 source senses**. All 72 directed pairs have nonzero attested coverage. Pair counts range from 3,423 to 385,812 source lookup forms with a target translation; every individual count and its definition is in `readme.html` and `data/manifest.json`. These figures do not imply equal coverage across languages or senses.

The corpus uses 978 concept shards and 1,347 lexical shards, with at most 1,024 records per shard. The largest uncompressed shard is 614,958 bytes. Runtime compressed partitions total 71,835,750 bytes; original compressed source snapshots are separate and are never loaded for lookup. Imports run in a worker and are limited to two concurrent shards. Object overhead, browser caches and IndexedDB's disk footprint exceed compressed payload sizes; no claim of a measured browser peak-memory bound is made.

## Checks completed

`python3 translate/tests/validate_data.py` — **PASS**:

- Independently decompressed every partition; checked SHA-256, compressed/uncompressed sizes, record counts, sorted ranges and UTF-8 decoding.
- Recomputed every headword count, headword–sense count and lookup-form count from the actual records.
- Recomputed all 72 directional pair coverages from source/target presence, without assuming full multilingual coverage.
- Validated every lexical reference and every target-language mask against the concept records.
- Verified per-form and per-definition provenance, and the correct English/Japanese language labels on Japanese WordNet definitions.
- Verified all 29 original source snapshot hashes and the presence of their license/copyright notices.
- Checked equivalent sample markup, six distinct hexadecimal identities and all local HTML links.
- Confirmed no replacement characters in the generated lexical records. Empty/corrupt source forms are excluded: 56 from the Wiktionary English extract and one from FreeDict Japanese–German. Rejections are recorded in the manifest.

`node translate/tests/browser.cjs` (with `PLAYWRIGHT_MODULE` pointing to Playwright) — **PASS**, 16 integration check groups. Machine-readable results are in `tests/browser-results.json`:

- Queried all 72 directed pairs against the real WordNet water sense `14845743-n`, including result pagination.
- Tested NFC/NFD Hungarian input, Latin macrons, Cyrillic and Japanese results.
- Tested bounded prefix suggestions and keyboard operation, long complete-phrase reverse lookup, and repeated lookups with **zero additional dictionary requests**.
- Tested UI lookup, language swap, clear, history, favorites, clipboard and JSON export with the correct Program ID, millisecond timestamp and attribution.
- Opened all three samples and verified separate settings namespaces and shared dictionary storage.
- Paused a Hungarian download and verified that committed chunks remained while incomplete coverage was not reported as ready.
- Completed Latin's 140 required chunks (14,234,309 compressed transfer bytes, with already installed shared chunks reused); repeating the download caused no dictionary transfer.
- Reloaded offline and translated Latin `aqua` to Japanese; opened a different sample entirely offline.
- Checked desktop and 390-pixel mobile layouts, with no horizontal page overflow; visually inspected screenshots.
- Rejected corrupt dictionary bytes before installation. Observed no uncaught application errors.

JavaScript syntax checks, Python compilation and staged `git diff --check` — **PASS**. Original upstream notices retain their original whitespace and encoding through a directory-scoped `.gitattributes` exception. No application runtime packages are required.

## Remaining limits

Six languages remain below the headword target, as explicitly shown above. Source spellings, historical FreeDict Hungarian accents, proper names, phrases, reading/spelling alternatives and upstream alignment errors remain visible rather than being silently rewritten. Source-provenance validation does not replace linguistic review of every translation. Definitions, gender, inflections and other grammar are shown only when present and parsed from the source. Latin macrons are not generated for unmarked forms.

This release was browser-tested in Chromium; Firefox, Safari, Android System WebView, device-specific quota limits, storage eviction and an APK wrapper have not been field-tested. Quota errors and interrupted chunk transactions are handled, but the browser test does not force an actual disk-full condition. See `readme.html` for licenses, source access, reproducible builds, expansion guidance and future Android packaging requirements.
