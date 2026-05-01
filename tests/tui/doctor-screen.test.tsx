import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DoctorReport } from "../../src/cli/commands/doctor.js";
import { DoctorScreen } from "../../src/tui/screens/doctor.js";
import { createSetupRemediationAction } from "../../src/review/index.js";
import { err } from "../../src/types/result.js";
import {
  createAppHomeStatus,
  createReadyReadinessReport,
  createReadyRuntimeStatus,
  flushInk
} from "./helpers.js";

describe("DoctorScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes the doctor report after successful remediation", async () => {
    const loadReport = vi
      .fn<() => Promise<DoctorReport>>()
      .mockResolvedValue(createDoctorReport());
    const launchAction = vi.fn().mockResolvedValue({
      kind: "success",
      message: "Remediation completed. Refreshing state…",
      refresh: true
    });

    const app = render(
      <DoctorScreen loadReport={loadReport} launchAction={launchAction} />
    );
    await flushInk();

    app.stdin.write("\r");
    await flushInk();

    expect(launchAction).toHaveBeenCalledTimes(1);
    expect(loadReport).toHaveBeenCalledTimes(2);
    expect(app.lastFrame()).toContain("Remediation completed. Refreshing state…");

    app.unmount();
  });
});

function createDoctorReport(): DoctorReport {
  return {
    appHomeStatus: createAppHomeStatus(),
    runtimeStatus: createReadyRuntimeStatus(),
    readinessReport: {
      ...createReadyReadinessReport(),
      checks: [
        {
          code: "runtime",
          tier: "required",
          ready: false,
          summary: "No compatible Feynman runtime was found on PATH.",
          details: [],
          remediation: createSetupRemediationAction(
            "Install or expose a compatible Feynman runtime."
          )
        }
      ],
      requiredReady: false
    },
    revisionConfigResult: err({
      code: "managed_credential_missing",
      message: "Pi-managed credential state for \"openai-codex\" was not found.",
      details: [
        "Run `uraniborg revision --setup` to complete browser login for this revision profile."
      ]
    })
  };
}
