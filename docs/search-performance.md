# Unified Search Performance Baseline

This benchmark tracks local filtering/sorting latency for mixed Unified Search datasets.

## Command

```bash
npm run perf:search
```

Optional flags:

```bash
node scripts/search-perf.mjs --warmup 3 --iterations 12 --query "incident research workflow"
```

## Harness details

- Uses `tests/search-perf.bench.ts` with deterministic synthetic datasets.
- Benchmarks `filter*Entries()` + `topKSearchResults()` for threads/spaces/collections/files/tasks.
- Runs with timeline window `30d`, sort `relevance`, and top-k limit `20`.
- Reports `median`, `p95`, `mean`, and `max` elapsed milliseconds.

## Baseline (2026-02-11)

Run: `npm run perf:search`

| Dataset size | Median | p95 | Mean | Max |
| --- | --- | --- | --- | --- |
| 1,000 | 0.16 ms | 0.65 ms | 0.20 ms | 0.65 ms |
| 5,000 | 0.52 ms | 0.92 ms | 0.55 ms | 0.92 ms |
| 10,000 | 0.95 ms | 3.77 ms | 1.29 ms | 3.77 ms |

Update this table when search-path logic changes meaningfully.
