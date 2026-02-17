# Self-Hosted GitHub Actions Runner

This repository is configured to run all GitHub Actions jobs on `self-hosted` runners.

## Runner Requirements

Use a dedicated machine (recommended: Linux) with:

- `git`
- `bash`
- Node.js `20.x` and `npm` (the workflow also runs `actions/setup-node`)
- network access to `github.com`, `api.github.com`, `objects.githubusercontent.com`, and `registry.npmjs.org`
- Docker engine + CLI (`docker --version`) for full `.github/workflows/scorecard.yml` coverage

Optional but recommended:

- `jq` (for local debugging scripts)
- systemd service support (Linux) for auto-starting the runner

## Register The Runner (Repository Scope)

1. Open this repository on GitHub.
2. Go to `Settings` -> `Actions` -> `Runners`.
3. Click `New self-hosted runner`.
4. Select your OS/architecture and copy the generated commands.
5. On the target machine, run the downloaded `config.sh` command exactly as shown by GitHub.
6. Start the runner:
   - foreground: `./run.sh`
   - service (Linux): `sudo ./svc.sh install && sudo ./svc.sh start`
7. Confirm runner status is `Idle` in `Settings` -> `Actions` -> `Runners`.

## Platform Notes

- `CI` and `Smoke` workflows are Node-only.
- `Scorecard` checks Docker at runtime:
  - if Docker exists: full Scorecard scan + SARIF upload
  - if Docker is missing: workflow logs a skip notice and exits successfully
- `Release Please` requires repository permissions and runs with `GITHUB_TOKEN`.

## Local End-To-End Validation

Run the same commands used by CI on the runner machine:

```bash
npm ci
npm run check:workflows
npm run check:operator-docs
npm run check:smoke-fixtures
npm run check:clone-features
npm run check:project-memory
npm run lint -- --max-warnings=0
npm test
npm run build
npm run smoke:mock
```

Scorecard preflight on the same machine:

```bash
docker --version
```
