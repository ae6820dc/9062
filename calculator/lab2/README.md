# Mathematics Studio II

Static entry points: `../{calculator-folder}/sample2.html`. All original files remain unchanged. New versions reuse the existing local Apache-2.0 math.js 15.1.0 runtime and original engine; no CDN or backend is required. See `../advanced-algebra/math.js.LICENSE.txt` (or the license file in that folder) for runtime licensing.

## Arithmetic contracts

- Every calculator: decimal arithmetic and scalar functions at 16–1000 requested significant digits, using BigNumber algorithms and 20 guard digits; exact rational expressions with BigInt-backed Fraction; symbolic derivatives with high-precision evaluation.
- Algebra: high-precision rectangular complex add/subtract/multiply/divide, exact rational and high-precision RREF, plus all original polynomial/system/complex/simplification operations.
- Calculus: BigNumber bisection with residual and bracket diagnostics, composite Simpson refinement with evaluation budget and error estimate, plus original integration, differentiation, roots, minimum, RK4.
- Matrix: exact rational and high-precision RREF (12 × 12), plus all original analysis, inverse, solve, products, powers and eigenvalues.
- Statistics: BigNumber Welford centered moments, plus original distributions, regression, descriptive statistics and exact combinatorics.
- Number theory: original exact integer Euclid, modular arithmetic, generalized CRT, deterministic 64-bit primality/factorization and Fibonacci; the shared new arithmetic/function tools are also available.

Original numerical modes remain IEEE 754 double precision. Increasing precision does not upgrade these operations. Complex powers and eigenvalues remain double precision. Exact expression powers require integer exponents with magnitude ≤10000. Supported exact expressions contain only numeric constants and arithmetic. High-precision expressions/functions use the restricted scalar function whitelist documented in the original input guide. All angles are radians. Input precision and problem conditioning can limit useful output digits. Guard digits do not constitute a rigorous error bound.

High-precision RREF uses computed zero tests: numerical rank can be unreliable near singularity. Use exact rational RREF for rational data. Simpson refinement assumes smoothness and may miss oscillations or singularities. Small root brackets require continuity; a pole is not a root. Large work or high precision may exceed configurable limits; no claim of universal 1000-digit accuracy is made.

## Execution and data

Each new entry has its own random Program ID and storage key in `manifest.json` and `config2.js`. State and backup imports are scoped to the new ID. No old keys are read. HTML, JSON and TXT result exports include the Program ID. JSON/HTML include calculation inputs, precision, method notes and diagnostics. Backups include settings, inputs and 40 journal entries. Browser storage may fail or be cleared; export backups for durable retention.

Calculation workers are disposable and terminate on completion, cancellation, or a configurable 1–120 second timeout. New iterative algorithms use a 10–100000 operation budget and report progress as budget usage (not predicted time remaining). Original modes retain their own algorithmic budgets. Curve sampling uses a separate worker with a 10-second limit. Plots have up to six curves, mouse/touch drag pan, wheel/button zoom and reset. Plot coordinates are double precision; zoom transforms sampled data and does not resample. Curves can miss discontinuities or fine features.

## Reproduce validation

From repository root:

```
node Calculator/tests/engine.test.cjs
node Calculator/lab2/test.cjs
cd Calculator/tests && npm ci && cd ../..
python -m http.server 8000
# In another terminal, with Chromium installed:
node Calculator/tests/browser.test.cjs
node Calculator/lab2/browser.test.cjs
```

The browser suites use Chromium at `/usr/bin/chromium`; override `CHROMIUM_PATH` if needed. They exercise every original and new operation, persistence, backup import validation, exports, precision, plotting, cancellation, and 375/768/1440 pixel layouts. Screenshots go to `/tmp` or `TEST_ARTIFACTS`. The mathematical suite covers 1000-digit root residuals and arithmetic, exact cancellation beyond 2^53, rational rank near singularity, large-offset variance, endpoints, reversed bounds, invalid inputs and exhausted budgets.

The repository's existing index workflow scans all files on pushes to main and therefore discovers every new sample2 entry. The root index tree is also refreshed in the implementation commit.
