# Advanced mathematics calculators

Five independent, static browser applications. Open the `sample1.html` entry points through GitHub Pages or a local HTTP server. Every folder includes its own scripts and math.js runtime; no CDN, build, or backend is needed.

- [Algebra & Equations](advanced-algebra/sample1.html) — Program ID `e5885f1ef4714e1fc38657f73df092a7`, storage key `0dc386e93bd52e35`.
- [Calculus & Analysis](calculus-analysis/sample1.html) — Program ID `0a1189b2c17aef6246ca92fb92d160ec`, storage key `d69dcdcddaa087a0`.
- [Matrix Laboratory](matrix-lab/sample1.html) — Program ID `5d6e006403c8ef9c1745a672c9359250`, storage key `dcfba9bf224a63e2`.
- [Statistics & Probability](statistics-probability/sample1.html) — Program ID `82e1404cf90692dd783fd3de1c240dce`, storage key `764eb51aea733912`.
- [Number Theory Studio](number-theory/sample1.html) — Program ID `dbf4a82416edca71eb9a3232ddb1ba01`, storage key `d78207b13accd0cb`.

Each app saves inputs, display precision and the last 40 calculations under its own localStorage key. Export/import JSON backups are versioned and scoped to a Program ID. Import replaces the current state after validation. Results can also be downloaded as text.

Numerical limitations, expression syntax and method assumptions are documented in the interface. Calculations run in a disposable worker with cancellation and a 15-second timeout. Integer operations use BigInt, while numerical calculations use double precision. No existing programs are modified.
