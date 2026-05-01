import { describe, expect, it } from "vitest";

import { resolveInteractiveBootstrap } from "../../src/tui/intent.js";

describe("resolveInteractiveBootstrap", () => {
  it("launches the dashboard for bare interactive invocation", () => {
    const result = resolveInteractiveBootstrap({
      argv: ["node", "uraniborg"],
      cwd: "/tmp/project",
      stdinIsTTY: true,
      stdoutIsTTY: true
    });

    expect(result.launchIntent).toEqual({
      route: {
        kind: "dashboard"
      }
    });
  });

  it("deep-links interactive run into run setup with the source file preselected", () => {
    const result = resolveInteractiveBootstrap({
      argv: ["node", "uraniborg", "run", "draft.md"],
      cwd: "/tmp/project",
      stdinIsTTY: true,
      stdoutIsTTY: true
    });

    expect(result.launchIntent).toEqual({
      route: {
        kind: "run-setup",
        sourcePath: "/tmp/project/draft.md"
      }
    });
  });

  it("deep-links interactive resume into run detail with resume requested", () => {
    const result = resolveInteractiveBootstrap({
      argv: ["node", "uraniborg", "resume", "run-123"],
      cwd: "/tmp/project",
      stdinIsTTY: true,
      stdoutIsTTY: true
    });

    expect(result.launchIntent).toEqual({
      route: {
        kind: "run-detail",
        runId: "run-123",
        resumeRequested: true
      }
    });
  });

  it("bypasses Ink for explicit --no-ui and strips the flag for commander", () => {
    const result = resolveInteractiveBootstrap({
      argv: ["node", "uraniborg", "--no-ui", "doctor"],
      cwd: "/tmp/project",
      stdinIsTTY: true,
      stdoutIsTTY: true
    });

    expect(result.launchIntent).toBeUndefined();
    expect(result.sanitizedArgv).toEqual(["node", "uraniborg", "doctor"]);
  });

  it("bypasses Ink for non-interactive TTY-less invocations", () => {
    const result = resolveInteractiveBootstrap({
      argv: ["node", "uraniborg", "history"],
      cwd: "/tmp/project",
      stdinIsTTY: false,
      stdoutIsTTY: true
    });

    expect(result.launchIntent).toBeUndefined();
  });

  it("bypasses Ink for help and version requests", () => {
    expect(
      resolveInteractiveBootstrap({
        argv: ["node", "uraniborg", "--help"],
        cwd: "/tmp/project",
        stdinIsTTY: true,
        stdoutIsTTY: true
      }).launchIntent
    ).toBeUndefined();

    expect(
      resolveInteractiveBootstrap({
        argv: ["node", "uraniborg", "--version"],
        cwd: "/tmp/project",
        stdinIsTTY: true,
        stdoutIsTTY: true
      }).launchIntent
    ).toBeUndefined();
  });
});
