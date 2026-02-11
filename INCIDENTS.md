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
  Trigger: `npm test -- tests/unified-search.test.ts` failed after adding a new `stripUnifiedSearchOperators` regression assertion.
  Impact: Verification temporarily failed; no production runtime incident.
  Root Cause: The new assertion expected quote-character preservation, but operator-token normalization intentionally strips wrapping quotes while preserving token text semantics.
  Fix: Updated the assertion to validate semantic retention (`foo:bar literal type:threads`) and reran targeted + full verification.
  Prevention Rule: For parser-strip tests, assert semantic inclusion/exclusion behavior rather than literal quote serialization unless quote preservation is an explicit contract.
  Evidence: Failing then passing `npm test -- tests/unified-search.test.ts`.
  Commit: 63829c1
  Confidence: high
- Date: 2026-02-11
  Trigger: `node scripts/smoke.mjs --provider mock --skip-build` failed with `/smoke-search/stale-selection did not expose expected stale-selection recovery control`.
  Impact: Verification temporarily failed; no production runtime incident.
  Root Cause: Smoke assertion required contiguous text `Prune stale (1)`, but SSR output split the number with React comment separators (`Prune stale (<!-- -->1<!-- -->)`).
  Fix: Updated stale-selection matcher to SSR-safe regex (`Prune stale\\s*\\((?:<!-- -->)?1(?:<!-- -->)?\\)`), then reran build+smoke checks.
  Prevention Rule: For SSR smoke text assertions, assume React may inject comment separators between adjacent text nodes and validate against captured HTML.
  Evidence: Failed then passing `npm run build && node scripts/smoke.mjs --provider mock --skip-build`.
  Commit: b935bf5
  Confidence: high
- Date: 2026-02-11
  Trigger: `node scripts/smoke.mjs --provider mock --skip-build` failed with `/smoke-search/saved-roundtrip controls did not preserve saved-search filter/sort/timeline/limit/verbatim state`.
  Impact: Verification temporarily failed; no production runtime incident.
  Root Cause: Smoke assertion expected `<select>`-style filter markup and contiguous `verbatim:true` text, but the UI renders filter state as pill buttons and SSR output inserts React comment separators around adjacent text nodes.
  Fix: Updated smoke assertions to detect selected tasks pill styling (`border-signal-accent`) and use SSR-safe regex for verbatim text (`verbatim:(?:<!-- -->)?true`).
  Prevention Rule: Inspect real SSR HTML snapshots before finalizing selector/text assertions; prefer semantic, resilient patterns over markup-shape assumptions.
  Evidence: Failed then passing `npm run lint -- --max-warnings=0 && npm run check:workflows && npm test && npm run build && node scripts/smoke.mjs --provider mock --skip-build`.
  Commit: a45d4c1
  Confidence: high
- Date: 2026-02-11
  Trigger: `node scripts/smoke.mjs --provider mock --skip-build` failed with `/__smoke/search fixture path returned 404`.
  Impact: Verification temporarily failed; no production runtime incident.
  Root Cause: Initial smoke fixture route used underscore-prefixed App Router segment (`src/app/__smoke/...`), which is private/non-routable in Next.js.
  Fix: Moved route to `src/app/smoke-search/page.tsx`, kept env gate (`SMOKE_ENABLE_SEARCH_FIXTURE=1`), and updated smoke assertions to hit `/smoke-search`.
  Prevention Rule: Treat underscore-prefixed app segments as private; for smoke routes, confirm route appears in `next build` output before wiring assertions.
  Evidence: Failing then passing `npm run check:workflows && npm test && npm run build && node scripts/smoke.mjs --provider mock --skip-build`.
  Commit: f3e107b
  Confidence: high
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
