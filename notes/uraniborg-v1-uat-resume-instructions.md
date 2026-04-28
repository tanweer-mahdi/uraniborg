# Uraniborg UAT Resume Instructions

Date: 2026-04-25
Status: Ready to resume under the `fix-first-run-setup-contract` change

This document is the shortest practical path for resuming UAT after the first-run setup contract rewrite.

It is intentionally narrower than the broader UAT plan and is meant to be used as an execution checklist.

## Read This First

- UAT is no longer blocked on `~/.uraniborg/vendor/feynman`.
- Uraniborg now expects a compatible host-level `feynman` on `PATH`.
- Run UAT from your normal shell on the machine, not from a restricted sandbox.
- Use the built CLI entrypoint directly:

```bash
node dist/src/cli/main.js <command>
```

Do not rely on the packaged `bin` path yet. `package.json` still points at `./dist/cli/main.js`, while the working built entrypoint remains `dist/src/cli/main.js`.

## Preconditions

Before resuming UAT, confirm all of these are true in your normal shell:

1. `feynman --version` succeeds.
2. `npm run validate` succeeds in the repo.
3. You have:
   - a real refine base URL
   - a real refine API key
   - a real refine model
4. You have at least one Markdown draft to use as a live run fixture.

If `feynman --version` works in your normal shell but fails inside a sandbox, trust the normal-shell result for UAT readiness.

## Recommended Resume Flow

Run these commands in order.

### 1. Rebuild and validate

```bash
npm run validate
npm run build
```

Expected:

- validation passes
- build completes

### 2. Check environment readiness

```bash
node dist/src/cli/main.js doctor
```

Pass if:

- Uraniborg creates `~/.uraniborg/` as needed
- Uraniborg reports a compatible discovered Feynman runtime
- Uraniborg reports refinement setup truthfully
- recommended research capabilities are warnings, not blockers

Capture:

- the exact Feynman runtime path Uraniborg selected
- whether refinement is ready or incomplete

### 3. Complete minimal refine setup

```bash
node dist/src/cli/main.js init
```

Expected default prompts:

- `OpenAI-compatible refine endpoint URL`
- `Refine API key`
- `Default refinement model`

Fail if the default path asks for:

- environment variable name
- timeout
- temperature
- max output tokens

After completion, inspect:

```bash
cat ~/.uraniborg/config.json
```

You should see a Uraniborg config that reflects the values you entered.

### 4. Re-check runtime and model visibility

```bash
node dist/src/cli/main.js doctor
node dist/src/cli/main.js models
```

Pass if:

- `doctor` reports discovered review-runtime readiness
- `models` reports the selected runtime path/version
- `models` reports refine endpoint and default model readiness
- recommended AlphaXiv/web-search gaps remain warnings

### 5. Run a real single-iteration draft

```bash
node dist/src/cli/main.js run path/to/draft.md --iterations 1
```

Pass if:

- preflight blocks only on required failures
- recommended-only research gaps do not block
- a successful run writes canonical artifacts under `~/.uraniborg/runs/`

Inspect at minimum:

- `run.json`
- `config.snapshot.json`
- `original.md`
- `current.md`
- `final.md`
- `information-highway.md`

### 6. Check history

```bash
node dist/src/cli/main.js history
```

Pass if:

- no-run state is clear before any run exists
- completed runs appear with sensible IDs, timestamps, status, and iteration counts after execution

### 7. Interrupt and resume

Use a slower or multi-iteration run, interrupt with `Ctrl+C`, then resume:

```bash
node dist/src/cli/main.js resume <run-id>
```

Pass if:

- the interrupted run is marked `cancelled`
- `resume` restarts from the correct persisted state
- no completed artifacts are lost or silently overwritten

## How To Judge Failures

Treat these as real blockers:

- no compatible `feynman` detected in your normal shell
- `doctor` or `run` still requires `~/.uraniborg/vendor/feynman`
- `init` still asks for env-var naming or advanced tuning knobs in the default path
- refinement is reported ready when base URL, API key, or model are not actually usable
- recommended AlphaXiv/web-search gaps become hard blockers after required readiness is satisfied

Treat these as non-blocking caveats unless they prevent the journey:

- `init` wording is still somewhat internal (`refinement`, `endpoint URL`)
- sandboxed readiness checks disagree with host-shell readiness
- legacy configs still reference `apiKeyEnvVar`, as long as the migrated/new path works correctly

## Evidence Template

Use this for each resumed UAT case:

```text
Case:
Environment:
Command:
Expected:
Observed:
Artifacts:
Pass/Fail:
Notes:
```

## Suggested First Resume Session

If you want the minimum useful restart, do exactly this:

```bash
npm run validate
npm run build
node dist/src/cli/main.js doctor
node dist/src/cli/main.js init
node dist/src/cli/main.js doctor
node dist/src/cli/main.js models
node dist/src/cli/main.js run path/to/draft.md --iterations 1
node dist/src/cli/main.js history
```

If that sequence succeeds in your normal shell, UAT is genuinely resumed rather than only theoretically unblocked.
