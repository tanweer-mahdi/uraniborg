# Uraniborg v1 UAT Instructions

This is the practical execution guide for [uraniborg-v1-uat-plan.md](./uraniborg-v1-uat-plan.md).

## Preconditions

- Node.js `>= 20`
- dependencies installed with `npm install`
- project built with `npm run build`
- a compatible `feynman` executable on `PATH`
- a real refine endpoint, API key, and model for `uraniborg init`

Use the built CLI directly:

```bash
node dist/src/cli/main.js <command>
```

## Quick UAT Flow

1. Start from a fresh home directory or clean `~/.uraniborg/`.
2. Run `doctor`.
3. Run `init`.
4. Run `models`.
5. Run `run <draft.md> --iterations 1`.
6. Inspect artifacts under `~/.uraniborg/runs/`.
7. Run `history`.
8. If possible, interrupt a longer run and validate `resume`.

## Step 1: Validate Build

```bash
npm run validate
```

Record:

- whether the full validation gate passes
- the exact command output if it fails

## Step 2: Check Environment Readiness

```bash
node dist/src/cli/main.js doctor
```

Pass if:

- app-home layout is created
- Uraniborg reports a compatible discovered Feynman runtime, or clearly explains why none is usable
- Uraniborg reports refinement readiness truthfully
- recommended research gaps are warnings, not blockers

Fail if:

- Uraniborg still requires `~/.uraniborg/vendor/feynman`
- Uraniborg tries to launch a nonexistent vendored binary
- refinement is reported ready when API key, base URL, or model is not actually usable

## Step 3: Run Minimal Init

```bash
node dist/src/cli/main.js init
```

Expected basic prompts:

- OpenAI-compatible refine endpoint URL
- Refine API key
- Default refinement model

Fail if the default path asks for:

- environment variable name
- timeout
- temperature
- max output tokens

After completion, inspect `~/.uraniborg/config.json` and confirm the saved config is consistent with the answers you provided.

## Step 4: Check Model Visibility

```bash
node dist/src/cli/main.js models
```

Pass if:

- Uraniborg reports the selected Feynman runtime path/version when review runtime is ready
- available review models are shown truthfully
- refinement readiness shows base URL and default model when ready
- incomplete refinement setup is reported as incomplete rather than as ready

## Step 5: Execute a Real Run

```bash
node dist/src/cli/main.js run path/to/draft.md --iterations 1
```

Pass if:

- preflight blocks only on required failures
- recommended AlphaXiv/web-search gaps are warnings
- a successful run writes:
  - `run.json`
  - `config.snapshot.json`
  - `original.md`
  - `current.md`
  - `final.md`
  - `information-highway.md`
  - iteration artifacts and logs

Fail if:

- run starts without a compatible review runtime
- run starts without runnable refinement setup
- recommended-only gaps become blocking

## Step 6: Inspect History

```bash
node dist/src/cli/main.js history
```

Pass if:

- no-run state is clear before first run
- completed runs show expected identifiers, timestamps, status, and iteration counts afterward

## Step 7: Interrupt And Resume

Use a multi-iteration run or a slower provider-backed run, then interrupt with `Ctrl+C`.

```bash
node dist/src/cli/main.js resume <run-id>
```

Pass if:

- the interrupted run is marked `cancelled`
- `resume` restarts from the correct persisted state
- no completed artifacts are lost or overwritten incorrectly

## Failure Capture Template

```text
Case:
Environment:
Runtime state:
Command:
Observed:
Expected:
Artifacts:
Next action:
```

## Important Notes

- Do not work around missing readiness by copying binaries into `~/.uraniborg/vendor/feynman`.
- Do not treat a globally available but incompatible `feynman` as a pass.
- Do record the exact selected runtime path Uraniborg reports when multiple `feynman` installations exist on `PATH`.
