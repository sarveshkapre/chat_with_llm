# Unified Search Operators

Signal Search supports inline operators in `/search` to narrow mixed results.

## Supported operators

- `type:threads|spaces|collections|files|tasks`: limit to a result type.
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
| `space:` | Yes | Yes | No | No | Yes |
| `spaceId:` | Yes | Yes | No | No | Yes |
| `tag:` / `-tag:` | Yes | Yes | No | No | No |
| `is:` / `-is:` | Yes | No | No | No | No |
| `has:` / `-has:` | Yes | No | No | No | No |
| `verbatim:` / `exact:` | Yes | Yes | Yes | Yes | Yes |

When an operator is outside a result type's scope, that result type is excluded in mixed (`type:all`) searches.

## Examples

- `type:threads is:pinned has:citation incident postmortem`
- `type:threads space:"Research" tag:alpha -is:archived -has:note`
- `type:spaces tag:customer roadmap`
- `type:all verbatim:true "root cause analysis"`
