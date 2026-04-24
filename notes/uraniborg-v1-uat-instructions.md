# Uraniborg v1 UAT Instructions

This document is the practical execution guide for the broader plan in [uraniborg-v1-uat-plan.md](./uraniborg-v1-uat-plan.md).

Use this when you want to actually run UAT, not just review the coverage matrix.

## If This Is Your First Node Package Test

That is fine. You do not need to know Node packaging deeply to do the first UAT pass.

For your first pass, you only need to understand three things:

1. `npm install`
   - installs the project dependencies
2. `npm run build`
   - compiles the TypeScript source into runnable JavaScript under `dist/`
3. `node dist/src/cli/main.js ...`
   - runs the built CLI directly

You do not need to publish the package.
You do not need to install it globally.
You do not need to know how npm package distribution works to begin UAT.

## What You Are Testing

You are answering this question:

“Can a real user clone this repo, build it, configure it, run it, inspect artifacts, and recover from failures in a predictable way?”

That is the purpose of UAT here.

## Mental Model

There are two separate ideas:

### 1. Environment

This means the kind of machine or home-directory state you are testing in.

In plain English, this means:

- what kind of machine or shell you are using
- whether Uraniborg has been used there before
- whether the Uraniborg-managed files under `~/.uraniborg/` are clean, healthy, or broken
- whether you can safely interrupt a running command with `Ctrl+C`

Think of an environment as the overall testing setup.

Examples:

- a new laptop account that has never used Uraniborg
- your normal machine where Uraniborg has already been run before
- a machine where Uraniborg files exist but are intentionally broken for testing
- a terminal session where you can start a run and interrupt it

### Concrete definitions

`fresh home`

- this means a home directory where Uraniborg has not been set up yet
- usually this means one of these:
  - `~/.uraniborg/` does not exist at all
  - `~/.uraniborg/` exists but you intentionally remove it before testing
  - you use a separate test account or temporary home directory that has never run Uraniborg

`already configured home`

- this means `~/.uraniborg/` already exists and contains a plausible working setup
- for example:
  - a `config.json` written by `uraniborg init`
  - one or more prior run folders under `~/.uraniborg/runs/`
  - a healthy pinned runtime under `~/.uraniborg/vendor/feynman`

`broken runtime or config environment`

- this means the environment is intentionally prepared so something Uraniborg depends on is wrong
- for example:
  - missing `config.json`
  - invalid JSON in `config.json`
  - missing pinned runtime manifest
  - pinned runtime exists but its executable is not runnable
  - pinned runtime version is different from what Uraniborg expects

`interruptible terminal`

- this means a normal terminal where you can start a command and then interrupt it with `Ctrl+C`
- you use this to test whether Uraniborg records `cancelled` state and resumes correctly

### What "bootstrap testing" means

`bootstrap testing` means:

- testing the very beginning of the user journey
- testing what happens when Uraniborg is run before it is fully set up
- checking whether Uraniborg creates or validates the files and directories it needs under `~/.uraniborg/`

In practice, bootstrap testing usually means:

1. start in a `fresh home`
2. run `doctor` and `init`
3. observe what Uraniborg creates
4. confirm it explains missing pieces clearly instead of failing mysteriously

Bootstrap testing is not the same thing as a full successful run.
It is the “can this product prepare itself and explain its prerequisites?” phase.

### 2. Runtime Artifact State

This means what Uraniborg has created under `~/.uraniborg/`.

The most important example is:

- the pinned Feynman runtime under `~/.uraniborg/vendor/feynman`

In plain English, this means:

- the state of the files Uraniborg owns or relies on inside your home directory
- especially the ones that change over time as Uraniborg is initialized, run, interrupted, resumed, or broken on purpose for testing

You can think of runtime artifact state as:

- the state of Uraniborg’s local installation and run data
- not the whole machine, just Uraniborg’s files

Examples of Uraniborg-managed or Uraniborg-relevant runtime artifacts:

- `~/.uraniborg/config.json`
- `~/.uraniborg/vendor/feynman/`
- `~/.uraniborg/runs/`
- each run directory and its `run.json`

Important:

- the pinned runtime is not a separate environment type
- it is a thing whose state changes inside an environment

That distinction matters:

- `environment` answers: “What kind of machine/home-directory situation am I testing in?”
- `runtime artifact state` answers: “What is the condition of Uraniborg’s files inside that environment?”

Example:

- you can have a `fresh home` environment where the pinned runtime is missing
- you can also have a `broken runtime` environment where the home is not fresh, but the pinned runtime exists in a bad state

### Concrete runtime states

`runtime missing`

- Uraniborg has not yet created the pinned runtime, or required files are absent
- example:
  - `~/.uraniborg/vendor/feynman/` does not exist
  - or it exists but the manifest is missing

`runtime healthy`

- the pinned runtime exists and is usable
- example:
  - manifest exists
  - executable exists
  - executable runs
  - version matches what Uraniborg expects

`runtime broken`

- the pinned runtime exists, but something about it is wrong
- example:
  - manifest exists but is invalid
  - executable path is wrong
  - executable is not runnable
  - version mismatches
  - provider access is not set up for successful review-side work

Use this rule:

- in bootstrap testing, it may start missing
- in successful run testing, it should already work
- in broken-runtime testing, it should exist but be broken

### Simple examples

Example 1: first-time setup

- environment: fresh home
- runtime artifact state: missing
- what you test:
  - does `doctor` create `~/.uraniborg/`?
  - does Uraniborg explain what is still missing?

Example 2: normal successful run

- environment: already configured home
- runtime artifact state: healthy
- what you test:
  - can `run` complete successfully?
  - are artifacts and history written correctly?

Example 3: broken runtime handling

- environment: broken runtime/config environment
- runtime artifact state: broken
- what you test:
  - does Uraniborg fail clearly?
  - does it avoid silent fallback?
  - does it offer appropriate remediation guidance?

Example 4: interruption and resume

- environment: interruptible terminal
- runtime artifact state: healthy
- what you test:
  - does `Ctrl+C` mark the run as cancelled?
  - does `resume` restart from the correct state?

## Before You Start

You need:

- Node.js `>= 20`
- npm dependencies installed
- a way to test with the pinned Feynman runtime under `~/.uraniborg/vendor/feynman`
- working review-side access in that pinned runtime for successful run tests
- a refine endpoint and API key you can configure via `uraniborg init`

Clarification:

- You do not need the pinned runtime to already exist before every UAT case.
- For first-time bootstrap testing, you are checking whether Uraniborg creates or repairs the needed app-home state.
- But for a real successful `run` or `resume` test, you do need one environment where the pinned runtime is healthy enough to execute review-side work.

## Important Current Invocation Detail

For local UAT, use the built CLI entrypoint directly:

```bash
node dist/src/cli/main.js
```

Do not rely on `uraniborg` being installed globally yet.

Do not rely on the `package.json` `bin` path yet, because it currently points at `dist/cli/main.js` while the build emits `dist/src/cli/main.js`.

That mismatch is a product packaging issue.

For UAT right now, the safe command is:

```bash
node dist/src/cli/main.js ...
```

## Build And Validation

From the repo root:

```bash
npm install
npm run validate
npm run build
node dist/src/cli/main.js --help
```

Expected result:

- typecheck passes
- tests pass
- help output shows:
  - `init`
  - `doctor`
  - `models`
  - `run`
  - `resume`
  - `history`

If any of this fails, stop there and note the failure.
Do not continue into deeper UAT until the CLI can at least build and show help.

## Your First UAT Pass

If you want the shortest useful path, do only these steps first:

1. build and validate
2. run `doctor`
3. run `init`
4. run `models`
5. run one successful `run`
6. run `history`

Only after that should you try interruption, resume, and broken-state cases.

## Suggested Test Environments

Map your actual machines or shell setups to these:

- `ENV-A`
  - fresh `HOME` or fresh `~/.uraniborg/`
- `ENV-B`
  - existing valid `~/.uraniborg/` with prior successful runs
- `ENV-C`
  - broken runtime or broken config state
- `ENV-D`
  - environment where you can interrupt a run with `Ctrl+C`

## Suggested Runtime Artifact States

This is separate from the environment list above.

- `RT-1`
  - pinned runtime missing
  - typical for first-time bootstrap
- `RT-2`
  - pinned runtime present and healthy
  - needed for real successful run testing
- `RT-3`
  - pinned runtime present but broken or mismatched
  - used for failure and remediation testing

Simple mapping:

- `ENV-A` usually starts in `RT-1`
- `ENV-B` should usually be `RT-2`
- `ENV-C` is usually `RT-3`
- `ENV-D` should usually be `RT-2`

## Suggested Fixtures

Create these files somewhere outside the repo or in a temporary working directory.

Minimal draft:

```markdown
# Idea

We want to evaluate whether structured review plus memory-aware refinement produces more stable draft improvements than naive iterative rewriting.

## Claim

The loop may reduce oscillation by preserving explicit regression guards.

## Open Questions

- How should progress be measured?
- What would count as a regression?
```

Non-Markdown invalid fixture:

```text
This is not markdown.
```

Medium draft:

- use a real 2-4 page Markdown draft if available
- otherwise expand the minimal draft with:
  - abstract
  - method sketch
  - evaluation risks
  - limitations

If you are new to this, start with just:

- one minimal Markdown fixture
- one invalid `.txt` file

That is enough for the first pass.

## Evidence Capture Template

For each UAT case, record:

- case id
- environment id
- command run
- terminal output
- run id if one was created
- relevant artifact paths
- pass/fail
- notes

At minimum, preserve:

- `run.json`
- `review.log`
- `refine.log`
- `information-highway.md`
- any failure output shown in the terminal

If you want a simple method, create a text file called `uat-notes.txt` and append entries like:

```text
UJ-01
Command: node dist/src/cli/main.js doctor
Pass/Fail: pass
What happened: created ~/.uraniborg and reported refine config missing
```

## Phase 1: First-Run Hygiene

### 1. Check bootstrap and readiness

In `ENV-A`:

```bash
node dist/src/cli/main.js doctor
```

Verify:

- `~/.uraniborg/` is created if missing
- the command checks pinned runtime readiness
- refine configuration failures are explicit
- recommended capability gaps are warnings, not fake blockers

If the pinned runtime does not yet exist, that is acceptable in this phase.
What matters is whether Uraniborg handles the situation clearly and safely.

### 2. Configure Uraniborg-owned refine settings

```bash
node dist/src/cli/main.js init
```

Verify:

- it asks only for Uraniborg-owned refine configuration
- it writes `~/.uraniborg/config.json`
- it does not claim to manage Feynman internals directly

### 3. Inspect available models

```bash
node dist/src/cli/main.js models
```

Verify:

- review model discovery is shown clearly
- refine default model and endpoint are shown
- if review-side access is missing, remediation guidance is explicit

If this step fails because the pinned runtime is not yet healthy, record that and decide whether you are still in bootstrap testing or whether you need a healthy environment for the next steps.

## Phase 2: First Successful Run

### 4. Run one iteration

```bash
node dist/src/cli/main.js run /absolute/path/to/fixture-idea-minimal.md --iterations 1
```

If more than one review model is available, also pass:

```bash
--review-model <model>
```

If needed, also pass:

```bash
--refine-model <model>
```

Verify:

- a new run directory is created under `~/.uraniborg/runs/`
- the run finishes or fails clearly
- if successful, artifacts include:
  - `run.json`
  - `config.snapshot.json`
  - `original.md`
  - `current.md`
  - `final.md`
  - `information-highway.md`
  - `iter-1/input.md`
  - `iter-1/review.md`
  - `iter-1/refined.md`
  - `iter-1/changes.md`
  - `iter-1/review.log`
  - `iter-1/refine.log`

Important:

- This phase assumes you have an environment where the pinned runtime is actually healthy enough to run review-side work.
- If you do not, this phase is expected to fail and should be treated as “environment not yet ready for successful-run UAT,” not automatically as a product bug.

### 5. Inspect artifact hygiene

Check the created run directory manually.

Verify:

- `run.json` status matches terminal output
- `information-highway.md` contains one structured iteration block
- `iter-1/input.md` is the review-side input
- the review phase did not consume memory
- the refine phase used memory, review, and current draft

If this is your first ever pass, stop here after a successful result and record what happened.
That already gives you a meaningful first UAT checkpoint.

## Phase 3: History And Repeatability

### 6. Check history

```bash
node dist/src/cli/main.js history
```

Verify:

- the new run appears
- the state shown matches `run.json`
- timestamps and run ids are readable

### 7. Run a second draft

In `ENV-B`, repeat the run with another Markdown file.

Verify:

- prior runs remain untouched
- app-home reuse is clean
- no old artifacts are deleted

## Phase 4: Cancellation And Resume

### 8. Interrupt a run

Start a run with a larger draft or multiple iterations:

```bash
node dist/src/cli/main.js run /absolute/path/to/fixture-draft-medium.md --iterations 2
```

Interrupt it during:

- review
- refine
- memory update

Run separate attempts if needed.

Verify after each interruption:

- run state becomes `cancelled`
- partial artifacts and logs remain on disk
- the terminal gives resume guidance

### 9. Resume the interrupted run

```bash
node dist/src/cli/main.js resume <run-id>
```

Verify:

- `review_running` resumes by rerunning review
- `refine_running` resumes by rerunning refine
- `memory_update` resumes by rebuilding from existing iteration artifacts
- `finished` runs are rejected explicitly

If interruption testing feels too advanced for your first pass, skip it until you already have one successful run captured.

## Phase 5: Edge Cases

### 10. Invalid input file

```bash
node dist/src/cli/main.js run /absolute/path/to/fixture-non-markdown.txt
```

Verify:

- it rejects the input before creating run artifacts

### 11. Missing refine env var

- configure `init` to use an env var you have not exported
- then run:

```bash
node dist/src/cli/main.js doctor
node dist/src/cli/main.js run /absolute/path/to/fixture-idea-minimal.md --iterations 1
```

Verify:

- failure is explicit
- no silent fallback occurs

### 12. Broken runtime

In `ENV-C`, simulate:

- missing runtime manifest
- non-runnable pinned executable
- version mismatch

Then run:

```bash
node dist/src/cli/main.js doctor
node dist/src/cli/main.js models
node dist/src/cli/main.js run /absolute/path/to/fixture-idea-minimal.md --iterations 1
```

Verify:

- required review readiness blocks execution
- remediation guidance is relevant
- no `PATH` fallback is silently used

### 13. Empty history

In a fresh environment with no runs:

```bash
node dist/src/cli/main.js history
```

Verify:

- it prints an explicit no-runs message
- it does not crash

## UAT Execution Order

Use this order:

1. `doctor`
2. `init`
3. `models`
4. one successful `run`
5. `history`
6. interrupted `run`
7. `resume`
8. invalid input and broken-config cases
9. broken-runtime cases

Then map your observations back into:

- [uraniborg-v1-uat-plan.md](./uraniborg-v1-uat-plan.md)

## Simplest Possible Beginner Flow

If you want the least overwhelming version, do exactly this:

```bash
npm install
npm run validate
npm run build
node dist/src/cli/main.js --help
node dist/src/cli/main.js doctor
node dist/src/cli/main.js init
node dist/src/cli/main.js models
node dist/src/cli/main.js run /absolute/path/to/fixture-idea-minimal.md --iterations 1
node dist/src/cli/main.js history
```

If all of that works in a real environment, you already have a strong first UAT pass.

## How To Judge Results

Treat these as immediate defects:

- silent fallback to the wrong runtime
- lost run artifacts
- incorrect resume behavior
- run marked `finished` with missing artifacts
- review/refine boundary violations
- misleading messages that tell the user the wrong next step

Treat these as product gaps but not necessarily blockers:

- awkward wording
- rough prompts
- inconvenient manual steps that are explicit and safe

## If You Want A Minimal First Pass

If you do not want to run the full matrix yet, do only this:

```bash
npm run validate
npm run build
node dist/src/cli/main.js doctor
node dist/src/cli/main.js init
node dist/src/cli/main.js models
node dist/src/cli/main.js run /absolute/path/to/fixture-idea-minimal.md --iterations 1
node dist/src/cli/main.js history
```

That will tell you very quickly whether the product is merely test-complete or actually usable in a real environment.

## When To Call Something A Product Bug

Treat it as a likely product bug if:

- the CLI builds but the commands behave inconsistently
- Uraniborg silently uses the wrong runtime
- a run says it succeeded but artifacts are missing
- resume skips work it should have rerun
- warnings and blockers are mixed up in a misleading way

Treat it as an environment/setup issue first if:

- your refine API key is missing
- the real pinned runtime is not installed yet
- provider access is not configured in the review runtime
