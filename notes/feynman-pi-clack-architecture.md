# Feynman Pi Runtime TUI + Clack Prompting Architecture

This document is the authoritative guide for how Feynman splits responsibility between the shell, Clack-based setup prompts, and the embedded Pi runtime terminal UI. It is written to be self-sufficient: the implementation rules, file boundaries, launch path, and patch strategy are all stated here with concrete repo references.

Primary sources in this repository are:
- [bin/feynman.js](/Users/shahmahdihasan/feynman/bin/feynman.js:1)
- [src/index.ts](/Users/shahmahdihasan/feynman/src/index.ts:1)
- [src/cli.ts](/Users/shahmahdihasan/feynman/src/cli.ts:466)
- [src/setup/prompts.ts](/Users/shahmahdihasan/feynman/src/setup/prompts.ts:1)
- [src/setup/setup.ts](/Users/shahmahdihasan/feynman/src/setup/setup.ts:175)
- [src/model/commands.ts](/Users/shahmahdihasan/feynman/src/model/commands.ts:832)
- [src/pi/launch.ts](/Users/shahmahdihasan/feynman/src/pi/launch.ts:14)
- [src/pi/runtime.ts](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:13)
- [src/pi/pi-cli-wrapper.ts](/Users/shahmahdihasan/feynman/src/pi/pi-cli-wrapper.ts:15)
- [scripts/patch-embedded-pi.mjs](/Users/shahmahdihasan/feynman/scripts/patch-embedded-pi.mjs:509)

## 1. Architecture at a glance

Feynman is not a single terminal app. It is a shell that prepares state, a prompt layer that handles setup and login, and a Pi child process that owns the actual conversational TUI.

| Layer | Owns | Does not own |
|---|---|---|
| Feynman shell | Entry checks, package sync, settings normalization, model selection, session-dir resolution, child-process launch, diagnostics | The main interactive chat UI |
| Clack prompting flows | First-run setup, login selection, API key collection, yes/no install decisions, cancel handling | Long-lived chat state, session rendering, streaming UI |
| Pi runtime TUI | Chat editor, slash-command UI, session loop, model streaming, compaction, tool events | Feynman-specific bootstrap policy, shell-level diagnostics, bundled asset sync |

That split is visible in the top-level launcher: `bin/feynman.js` checks Node compatibility, runs the embedded Pi patcher, then imports the built app ([`bin/feynman.js`](/Users/shahmahdihasan/feynman/bin/feynman.js:24)). The app then goes through `src/index.ts` and `src/cli.ts` before spawning Pi ([`src/index.ts`](/Users/shahmahdihasan/feynman/src/index.ts:3), [`src/cli.ts`](/Users/shahmahdihasan/feynman/src/cli.ts:466)).

## 2. Authoritative call flow

The launch path is linear and should stay that way:

1. `bin/feynman.js` validates the Node runtime, runs `scripts/patch-embedded-pi.mjs`, then imports the built app ([`bin/feynman.js`](/Users/shahmahdihasan/feynman/bin/feynman.js:24-41)).
2. `src/index.ts` ensures the supported Node version again and calls `main()` from `src/cli.ts` ([`src/index.ts`](/Users/shahmahdihasan/feynman/src/index.ts:3-12)).
3. `src/cli.ts` resolves `appRoot`, `feynmanHome`, `feynmanAgentDir`, `sessionDir`, `settings.json`, and `auth.json`, then normalizes settings and routes top-level commands ([`src/cli.ts`](/Users/shahmahdihasan/feynman/src/cli.ts:466-524)).
4. If first-run setup is required, `runSetup()` executes Clack prompts and installs optional packages before the Pi child ever starts ([`src/setup/setup.ts`](/Users/shahmahdihasan/feynman/src/setup/setup.ts:175-218)).
5. Otherwise `launchPiChat()` spawns a child Node process with Pi's `main.js`, Feynman's wrapper, and the runtime args/env contract ([`src/pi/launch.ts`](/Users/shahmahdihasan/feynman/src/pi/launch.ts:14-74)).
6. The wrapper in `src/pi/pi-cli-wrapper.ts` sets Feynman-specific process markers, suppresses expected stdin noise, and calls Pi's exported `main(args)` ([`src/pi/pi-cli-wrapper.ts`](/Users/shahmahdihasan/feynman/src/pi/pi-cli-wrapper.ts:15-43)).
7. The embedded Pi runtime then owns the actual terminal interaction and session lifecycle.

The important invariant is that Feynman never reimplements the chat loop in the shell. It only prepares the environment, launches Pi, and exits when the child exits ([`src/pi/launch.ts`](/Users/shahmahdihasan/feynman/src/pi/launch.ts:56-74)).

## 3. Where Clack is used, and where it is not

Clack is used only for one-time or bounded setup flows:

- `src/setup/prompts.ts` is the only file that imports `@clack/prompts` directly. It wraps `intro`, `outro`, `text`, `select`, `confirm`, and `multiselect`, and it hard-fails when the terminal is not interactive ([`src/setup/prompts.ts`](/Users/shahmahdihasan/feynman/src/setup/prompts.ts:1-130)).
- `src/setup/setup.ts` uses those wrappers for first-run setup, package installation prompts, optional dependency prompts, and alphaXiv login prompts ([`src/setup/setup.ts`](/Users/shahmahdihasan/feynman/src/setup/setup.ts:50-218)).
- `src/model/commands.ts` reuses the same wrappers for model/provider login, API key setup, provider selection, and manual OAuth fallback input ([`src/model/commands.ts`](/Users/shahmahdihasan/feynman/src/model/commands.ts:832-957)).

Clack is not used for the chat UI itself. The shell uses Feynman's own ANSI terminal helpers for status output, but the interactive conversation belongs to Pi, not to Clack ([`src/ui/terminal.ts`](/Users/shahmahdihasan/feynman/src/ui/terminal.ts:1), [`src/pi/launch.ts`](/Users/shahmahdihasan/feynman/src/pi/launch.ts:46-60)).

Practical rule: if the flow can finish before the Pi session begins, Clack is acceptable. If the flow must survive for the lifetime of the conversation, it belongs to Pi.

## 4. The seam: settings, auth, models, sessions

Feynman owns the seam state and projects it into Pi. Pi then reads that state through its own registry/session mechanisms.

### Feynman-owned paths

- Home root: `~/.feynman` or `FEYNMAN_HOME` override via `getFeynmanHome()` ([`src/config/paths.ts`](/Users/shahmahdihasan/feynman/src/config/paths.ts:5-23)).
- Agent dir: `~/.feynman/agent` ([`src/config/paths.ts`](/Users/shahmahdihasan/feynman/src/config/paths.ts:9-11)).
- Memory dir: `~/.feynman/memory` ([`src/config/paths.ts`](/Users/shahmahdihasan/feynman/src/config/paths.ts:13-15)).
- State dir: `~/.feynman/.state` with bootstrap bookkeeping at `.state/bootstrap.json` ([`src/config/paths.ts`](/Users/shahmahdihasan/feynman/src/config/paths.ts:17-27)).
- Default session dir: `~/.feynman/sessions` ([`src/config/paths.ts`](/Users/shahmahdihasan/feynman/src/config/paths.ts:21-23)).
- Bundled settings and prompts/themes/agents/skills under the app root `.feynman/` tree, synchronized into the agent dir by `syncBundledAssets()` ([`src/bootstrap/sync.ts`](/Users/shahmahdihasan/feynman/src/bootstrap/sync.ts:173-187)).

### Files that cross the seam

- `settings.json` is the Feynman runtime config. Feynman normalizes it before launch, including default model selection and package list reconciliation ([`src/pi/settings.ts`](/Users/shahmahdihasan/feynman/src/pi/settings.ts:99-155)).
- `auth.json` is the Pi credential store, but the file lives in Feynman's agent dir rather than Pi's default `~/.pi/agent` location ([`src/cli.ts`](/Users/shahmahdihasan/feynman/src/cli.ts:518-523), [`scripts/patch-embedded-pi.mjs`](/Users/shahmahdihasan/feynman/scripts/patch-embedded-pi.mjs:500-505)).
- `models.json` is colocated with `auth.json` and used for custom providers and provider overrides ([`src/model/registry.ts`](/Users/shahmahdihasan/feynman/src/model/registry.ts:7-40), [`src/model/models-json.ts`](/Users/shahmahdihasan/feynman/src/model/models-json.ts:48-91)).
- Session state is passed into Pi via `--session-dir` and `FEYNMAN_SESSION_DIR`; Pi then auto-saves sessions in that directory ([`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:83-113), [`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:132-157), [Pi docs](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/README.md:221-268)).

### Ownership boundary

- Feynman owns the file paths, defaults, migration, and normalization.
- Pi owns the interpretation of `auth.json`, `models.json`, and session files once launched.
- The app should not keep any user-authenticated model identity only in RAM if the child process needs it later.

## 5. Runtime env and arg contract handed to Pi

`launchPiChat()` is the contract surface. If you are reproducing this architecture elsewhere, treat these args/env vars as the ABI between the shell and the runtime child.

### Args passed to Pi

Built in `src/pi/runtime.ts`:

- `--session-dir <path>` from Feynman session resolution ([`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:83-91)).
- `--extension <.../extensions/research-tools.ts>` so the Pi child loads Feynman's research tooling ([`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:83-91)).
- `--prompt-template <.../prompts>` so Feynman's prompt templates are visible to Pi ([`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:83-91)).
- `--system-prompt <contents of .feynman/SYSTEM.md>` when present ([`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:93-95)).
- Optional `--mode`, `--model`, `--thinking`, and `-p` or initial prompt depending on CLI mode ([`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:97-110)).

### Env passed to Pi

Built in `buildPiEnv()`:

- `FEYNMAN_VERSION`
- `FEYNMAN_SESSION_DIR`
- `FEYNMAN_MEMORY_DIR`
- `FEYNMAN_WEB_SEARCH_CONFIG`
- `FEYNMAN_NODE_EXECUTABLE`
- `FEYNMAN_BIN_PATH`
- `FEYNMAN_PI_CLI_PATH`
- `FEYNMAN_NPM_PREFIX`
- `FEYNMAN_CODING_AGENT_DIR`
- `PI_CODING_AGENT_DIR`
- `PANDOC_PATH`
- `PI_HARDWARE_CURSOR`
- `PI_SKIP_VERSION_CHECK`
- `MERMAID_CLI_PATH`
- `PUPPETEER_EXECUTABLE_PATH`
- `NPM_CONFIG_PREFIX`
- `npm_config_prefix`

See [`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:115-157).

Two details matter more than the list itself:

1. `cwd` for the child is the working directory, not the app root ([`src/pi/launch.ts`](/Users/shahmahdihasan/feynman/src/pi/launch.ts:56-60)).
2. The child gets `stdio: "inherit"`, so Feynman does not proxy terminal input/output; Pi owns the terminal from that point onward ([`src/pi/launch.ts`](/Users/shahmahdihasan/feynman/src/pi/launch.ts:56-60)).

## 6. Embedded Pi and pi-tui patching

Feynman customizes the embedded Pi runtime in place before the app code loads. This is not a fork, and it is not a runtime monkeypatch. The patch step happens at startup in `bin/feynman.js` and edits the installed package files directly ([`bin/feynman.js`](/Users/shahmahdihasan/feynman/bin/feynman.js:38-41), [`scripts/patch-embedded-pi.mjs`](/Users/shahmahdihasan/feynman/scripts/patch-embedded-pi.mjs:509-857)).

### What is patched

- `@mariozechner/pi-coding-agent` package metadata is rewritten to `name: "feynman"` and `configDir: ".feynman"` so the embedded runtime resolves Feynman-owned state ([`scripts/patch-embedded-pi.mjs`](/Users/shahmahdihasan/feynman/scripts/patch-embedded-pi.mjs:500-505)).
- The Pi CLI title is changed from `pi` to `feynman`, and stdin read errors like `EIO`/`EBADF` are ignored in the wrapper path ([`scripts/patch-embedded-pi.mjs`](/Users/shahmahdihasan/feynman/scripts/patch-embedded-pi.mjs:509-536), [`src/pi/pi-cli-wrapper.ts`](/Users/shahmahdihasan/feynman/src/pi/pi-cli-wrapper.ts:5-35)).
- `@mariozechner/pi-tui` terminal/editor behavior is patched to:
  - add stdin error handling,
  - rename the interactive mode banner,
  - change the editor placeholder text,
  - adjust the editor background and cursor rendering,
  - and keep the cursor visible with the Feynman visual style ([`scripts/patch-embedded-pi.mjs`](/Users/shahmahdihasan/feynman/scripts/patch-embedded-pi.mjs:539-765)).
- `pi-extension-loader` is patched so Windows absolute paths are converted through `pathToFileURL()` before dynamic loading ([`scripts/lib/pi-extension-loader-patch.mjs`](/Users/shahmahdihasan/feynman/scripts/lib/pi-extension-loader-patch.mjs:1-32)).
- `pi-web-access` is patched so the search config comes from `FEYNMAN_WEB_SEARCH_CONFIG`, and the default workflow is made opt-in rather than implicit ([`scripts/lib/pi-web-access-patch.mjs`](/Users/shahmahdihasan/feynman/scripts/lib/pi-web-access-patch.mjs:13-47)).
- `pi-subagents` is patched to use `FEYNMAN_CODING_AGENT_DIR` / `PI_CODING_AGENT_DIR` instead of hard-coded `~/.pi/agent` paths ([`scripts/lib/pi-subagents-patch.mjs`](/Users/shahmahdihasan/feynman/scripts/lib/pi-subagents-patch.mjs:13-18)).
- `pi-memory` is patched to read `FEYNMAN_MEMORY_DIR` and to exec via the Feynman binary path when available ([`scripts/patch-embedded-pi.mjs`](/Users/shahmahdihasan/feynman/scripts/patch-embedded-pi.mjs:837-856)).
- Pi OAuth branding and Google schema compatibility patches are applied before runtime use ([`scripts/patch-embedded-pi.mjs`](/Users/shahmahdihasan/feynman/scripts/patch-embedded-pi.mjs:803-823)).

### Why this matters

The patch layer is how Feynman keeps the upstream Pi runtime close to stock while still enforcing its own state root, branding, and terminal ergonomics. If you are building a similar app, prefer targeted startup patches over a broad fork unless you are willing to own the entire runtime forever.

## 7. Invariants and design rules

These are the rules that keep the architecture sane:

- The shell owns orchestration; the child owns conversation.
- Clack is for bounded setup and credential acquisition, never for the live chat loop.
- Every stateful boundary must have a stable file path and an explicit owner.
- If the child needs it after restart, pass it through filesystem, env, or args. Do not leave it in shell memory.
- Keep model identity, auth credentials, and session history in separate stores.
- Prefer one launcher contract over ad hoc process spawning paths.
- Patch embedded runtime files before process launch, not mid-session.
- Preserve `stdio: inherit` for the child; terminal mediation belongs to Pi once the chat UI starts.
- Treat `auth.json` as credential state, `settings.json` as app behavior state, `models.json` as provider definition state, and `sessions/` as conversation state.

These rules are reflected directly in Feynman's own helpers: settings normalization (`src/pi/settings.ts`), model registry wiring (`src/model/registry.ts`), session-dir plumbing (`src/pi/runtime.ts`), and startup diagnostics (`src/setup/doctor.ts`).

## 8. Reproduction recipe for another app

If you want to reproduce this architecture in another CLI app, use this checklist:

1. Create a thin binary entrypoint that only validates runtime prerequisites, applies embedded patches, and imports the real app.
2. Split the app into a shell layer and a child runtime layer.
3. Use Clack only for setup/login wizards, not for the persistent UI.
4. Define a single filesystem root for app-owned state and make the child consume it through env/args.
5. Normalize settings before launching the child, so the runtime starts with a valid default model and resource set.
6. Keep auth storage and model registry separate, even if they live next to each other on disk.
7. Pass the working directory and session directory explicitly; do not rely on process defaults.
8. Wrap the embedded runtime's CLI entrypoint so you can set titles, suppress benign stdin noise, and inject environment markers.
9. If you need to customize vendored UI packages, patch them at startup and keep the patch code in the repository, not in undocumented shell scripts.
10. Add a doctor/status command that reports missing pieces before the user tries to chat.

The Feynman implementation maps directly to that recipe:

- Entry and patching: [`bin/feynman.js`](/Users/shahmahdihasan/feynman/bin/feynman.js:1-41)
- App orchestration: [`src/cli.ts`](/Users/shahmahdihasan/feynman/src/cli.ts:466-685)
- Setup prompts: [`src/setup/setup.ts`](/Users/shahmahdihasan/feynman/src/setup/setup.ts:175-218)
- Runtime launch: [`src/pi/launch.ts`](/Users/shahmahdihasan/feynman/src/pi/launch.ts:14-74)
- Runtime ABI: [`src/pi/runtime.ts`](/Users/shahmahdihasan/feynman/src/pi/runtime.ts:13-157)
- Embedded wrapper: [`src/pi/pi-cli-wrapper.ts`](/Users/shahmahdihasan/feynman/src/pi/pi-cli-wrapper.ts:15-43)

## 9. Risks, tradeoffs, and debugging guidance

### Risks and tradeoffs

- Startup patching is powerful but brittle. Any upstream Pi package change can break a string-based patch or change the terminal behavior unexpectedly.
- The Feynman shell now owns more state coordination than a naive wrapper would. That is intentional, but it means settings/auth/model changes must stay synchronized across multiple files.
- The child process owns the terminal once launched, so shell-level debugging must happen before the spawn or after exit.
- The architecture depends on consistent env propagation. If a child path is missing, the failure should be immediate rather than silently degraded.

### Debugging surface

Use these commands and files first:

- `feynman doctor` for runtime, auth, session, and package checks ([`src/setup/doctor.ts`](/Users/shahmahdihasan/feynman/src/setup/doctor.ts:1-96)).
- `feynman status` for a concise status summary ([`src/setup/doctor.ts`](/Users/shahmahdihasan/feynman/src/setup/doctor.ts:97-171)).
- `feynman model list` to inspect the model registry and current default ([`src/model/commands.ts`](/Users/shahmahdihasan/feynman/src/model/commands.ts:807-830)).
- `feynman model login <provider>` when auth is missing or expired ([`src/model/commands.ts`](/Users/shahmahdihasan/feynman/src/model/commands.ts:856-914)).
- `feynman setup` when `shouldRunInteractiveSetup()` decides the environment is not ready ([`src/cli.ts`](/Users/shahmahdihasan/feynman/src/cli.ts:448-669)).
- `settings.json`, `auth.json`, `models.json`, and `sessionDir` if the runtime state looks inconsistent ([`src/pi/settings.ts`](/Users/shahmahdihasan/feynman/src/pi/settings.ts:99-155), [`src/model/models-json.ts`](/Users/shahmahdihasan/feynman/src/model/models-json.ts:1-91)).

### What to verify when something breaks

- If the UI still looks like stock Pi, the patch script did not run or did not find the target file.
- If auth works in setup but not in the runtime child, check that `FEYNMAN_CODING_AGENT_DIR` and `PI_CODING_AGENT_DIR` are present in the child env.
- If sessions are being saved in the wrong place, check the `--session-dir` arg and `FEYNMAN_SESSION_DIR` env.
- If the Pi child cannot start, verify `src/pi/runtime.ts` can locate the built wrapper, polyfill, and `pi-coding-agent` files before spawn.
- If a custom provider appears in `models.json` but is not available, inspect `auth.json` and the model registry resolution order in Pi docs ([`node_modules/@mariozechner/pi-coding-agent/docs/sdk.md`](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/docs/sdk.md:409-445)).

## 10. Minimal mental model

Keep this mental model in mind:

- Feynman decides what should happen.
- Clack collects one-time user input.
- Pi runs the conversation.

If a feature does not fit one of those buckets, the design is probably leaking responsibility across the seam.
