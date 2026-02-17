# Unified Search Operators

Signal Search supports inline operators in `/search` to narrow mixed results.

## Supported operators

- `type:threads|spaces|collections|files|tasks`: limit to a result type.
- `mode:quick|research|learn` (alias: `searchMode:`): filter thread/task search modes.
- `space:"name"`: space name contains match, or exact space id match.
- `spaceId:<id>`: exact space id match.
- `tag:<value>` / `-tag:<value>`: include/exclude tags.
- `is:favorite|pinned|archived` / `-is:<state>`: include/exclude thread states.
- `has:note|citation` / `-has:note|citation`: include/exclude note/citation presence.
- `verbatim:true|false` (alias: `exact:true|false`): phrase-only mode.

## Operator scope matrix

| Operator | Threads | Spaces | Collections | Files | Tasks |
| --- | --- | --- | --- | --- | --- |
| `type:` | Yes | Yes | Yes | Yes | Yes |
| `mode:` | Yes | No | No | No | Yes |
| `space:` | Yes | Yes | No | No | Yes |
| `spaceId:` | Yes | Yes | No | No | Yes |
| `tag:` / `-tag:` | Yes | Yes | No | No | No |
| `is:` / `-is:` | Yes | No | No | No | No |
| `has:` / `-has:` | Yes | No | No | No | No |
| `verbatim:` / `exact:` | Yes | Yes | Yes | Yes | Yes |

When an operator is outside a result type's scope, that result type is excluded in mixed (`type:all`) searches.

## Examples

- `type:threads is:pinned has:citation incident postmortem`
- `type:threads mode:research has:citation incident postmortem`
- `type:threads space:"Research" tag:alpha -is:archived -has:note`
- `type:spaces tag:customer roadmap`
- `type:all verbatim:true "root cause analysis"`

## Export semantics

- UI result limits (`Show: 10/20/50`) affect only on-screen sections.
- Markdown and CSV exports include all filtered matches, not just visible top-k cards.
- Export timestamps are emitted as `ISO (locale)` with invalid-date fallback text (`Unknown`).
- Markdown exports include environment metadata (`locale`, `timeZone`, `utcOffset`) for reproducibility.
- Saved-search exports include created/updated metadata for auditability.

## Keyboard precedence matrix

| Key | Suggestion menu open | Result row highlighted | Default behavior |
| --- | --- | --- | --- |
| `ArrowDown` / `ArrowUp` | Moves suggestion selection | Moves result highlight (when no suggestions) | No-op |
| `Tab` | Applies active suggestion | Browser default tab focus | Browser default tab focus |
| `Enter` | Applies active suggestion | Opens highlighted result | Commits current query to recents |
| `Esc` | Dismisses suggestions | Clears active result highlight | Clears query (if non-empty) |
| `/` | N/A | N/A | Focuses search input (outside editable fields) |

## Shareable URL state

- `/search` supports query-param state for shareable/reloadable filters:
- `q=<query>` (free text)
- `type=all|threads|spaces|collections|files|tasks`
- `sort=relevance|newest|oldest`
- `time=all|24h|7d|30d`
- `limit=10|20|50`
- `verbatim=true|false`
- Defaults are omitted from generated URLs (`type=all`, `sort=relevance`, `time=all`, `limit=20`, `verbatim=false`).
- Unknown params are preserved when search state updates, so `?debug=1` and other route params are not dropped.

## Diagnostics mode

- Append `?debug=1` to `/search` to show diagnostics cards.
- Diagnostics report per-type counts for `loaded`, `matched`, and `visible` records.
- Reason buckets show records filtered by `type scope`, `query/operator/time`, and `result limit`.
