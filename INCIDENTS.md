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
  Trigger: `npm run perf:search` failed with `No test files found`.
  Impact: Benchmark baseline capture was temporarily blocked; no production user impact.
  Root Cause: Harness invoked `npm exec vitest` without `--`, so npm consumed CLI flags and ignored the perf-specific test config.
  Fix: Added `vitest.perf.config.ts` for `*.bench.ts` coverage and updated runner invocation to `npm exec -- vitest run --config vitest.perf.config.ts`.
  Prevention Rule: When wrapping CLIs via `npm exec`, always include `--` and run one dry verification before recording baselines.
  Evidence: `npm run perf:search` (first fail, then pass with summary table).
  Commit: fbdbcbb
  Confidence: high
