# Incidents And Learnings

## Entry Schema
- Date
- Trigger
- Impact
- Root Cause
- Fix
- Prevention Rule
- Evidence
- Commit
- Confidence

## Entries
- Date: 2026-02-11
  Trigger: `node scripts/smoke.mjs --provider mock --skip-build` failed with `/search page did not contain expected Unified Search content`.
  Impact: Verification temporarily failed; no production runtime incident.
  Root Cause: Diagnostics flag detection used `useSearchParams`, which changed prerendered `/search` HTML behavior compared to smoke expectations.
  Fix: Replaced `useSearchParams` usage with a `window.location.search` effect to preserve static HTML while still supporting `?debug=1`.
  Prevention Rule: For smoke-guarded static routes, treat routing-hook additions as behavior changes and rerun smoke immediately; if SSR output changes, either preserve static output or update smoke assertions in the same commit.
  Evidence: Failed then passing `npm run lint -- --max-warnings=0 && npm run check:workflows && npm test && npm run build && node scripts/smoke.mjs --provider mock --skip-build`.
  Commit: d3f7396
  Confidence: high
- Date: 2026-02-11
  Trigger: `npm run perf:search` failed with `No test files found`.
  Impact: Benchmark baseline capture was temporarily blocked; no production user impact.
  Root Cause: Harness invoked `npm exec vitest` without `--`, so npm consumed CLI flags and ignored the perf-specific test config.
  Fix: Added `vitest.perf.config.ts` for `*.bench.ts` coverage and updated runner invocation to `npm exec -- vitest run --config vitest.perf.config.ts`.
  Prevention Rule: When wrapping CLIs via `npm exec`, always include `--` and run one dry verification before recording baselines.
  Evidence: `npm run perf:search` (first fail, then pass with summary table).
  Commit: fbdbcbb
  Confidence: high
