# Data Export, Reset, and Recovery

Signal Search is currently local-first: your threads/spaces/collections/files/tasks live in this browser's `localStorage` under keys that start with `signal-`.

## Export Raw Local Data
1. Open the app and go to **Library**.
2. In **Data tools**, click **Export raw local data**.

This downloads a JSON file containing every `signal-*` key/value from your browser, including any corruption backups.

Notes:
- The export can contain sensitive content (threads, notes, files). Store it securely.
- Exports are "raw": values are stored exactly as they appear in `localStorage` (often JSON strings).

## Reset This Browser (Local-Only)
1. Export raw local data first.
2. Click **Reset this browser** in **Library → Data tools**.

This removes all `signal-*` keys for Signal Search from this browser and reloads the app.

## Corruption Backups (`signal-corrupt-*`)
If Signal Search fails to parse a stored JSON blob, it will:
- Keep running with a safe fallback value.
- Save a best-effort backup copy of the corrupt raw string into `localStorage`:
  - `signal-corrupt-backup-v1:<originalKey>:<timestamp>`
  - `signal-corrupt-latest-v1:<originalKey>` (points to the most recent backup key)

### How To Recover Something From A Corrupt Backup
1. Export raw local data (Library → Data tools).
2. In the exported JSON, search for `signal-corrupt-latest-v1:` to find the latest backup pointer.
3. Find that backup key under `signal-corrupt-backup-v1:` and copy the raw value.
4. If you want to try restoring it:
   - Validate/repair the JSON locally.
   - Re-insert the repaired JSON into the original `signal-*` key via your browser devtools.

If you are not comfortable editing `localStorage`, export the data and reset the browser so the app becomes usable again.

