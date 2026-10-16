# Calculator verification

Run algorithm checks without installing dependencies:

```sh
node Calculator/tests/engine.test.cjs
```

For browser integration tests, install the pinned development dependency in this directory with `npm ci`. Serve the repository root with `python -m http.server 8000`, then run `npm run test:browser`. The test expects Chromium at `/usr/bin/chromium`; set `CHROMIUM_PATH` if needed. `TEST_BASE_URL` overrides the server origin and `TEST_ARTIFACTS` overrides the screenshot directory (default `/tmp`). No test dependency is shipped to the apps.

The suite covers all 28 operations, 22 numerical/exact test groups, 154 browser assertions, persistence, backup round trips, rejected foreign/malformed backups, restored history, validation, unique identifiers, complex serialization, and viewport overflow at mobile/tablet/desktop widths. Numerical reference cases include normal tails, complex polynomial roots, repeated roots, singular systems, matrix identity residuals, integral reversal, RK4 convergence, pseudoprimes, 64-bit factorization and non-coprime CRT.
