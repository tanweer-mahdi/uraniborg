import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RevisionAuthClient } from "../../src/config/index.js";
import { RevisionSetupScreen } from "../../src/tui/screens/revision-setup.js";
import { err } from "../../src/types/result.js";
import { createBrowserConfig, flushInk } from "./helpers.js";

describe("RevisionSetupScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves setup context and surfaces cancellation after browser login is cancelled", async () => {
    const authClient = createCancelledAuthClient();
    const browserLauncher = {
      open: vi.fn().mockResolvedValue(undefined)
    };

    const app = render(
      <RevisionSetupScreen
        loadInitialConfig={async () => createBrowserConfig()}
        authClient={authClient}
        browserLauncher={browserLauncher}
      />
    );
    await flushInk();

    app.stdin.write("\r");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();

    expect(app.lastFrame()).toContain("Profile: OpenAI/Codex");
    expect(app.lastFrame()).toContain("gpt-5.4");
    expect(app.lastFrame()?.toLowerCase()).toContain("cancelled");

    app.unmount();
  });
});

function createCancelledAuthClient(): RevisionAuthClient {
  return {
    async loginManagedCredential(_providerId, callbacks) {
      callbacks.onAuth({
        url: "https://example.com/login",
        instructions: "Complete login in the browser."
      });
      throw new Error("Browser login cancelled by user.");
    },
    async resolveManagedCredential(providerId) {
      return err({
        code: "managed_credential_missing",
        message: `Pi-managed credential state for "${providerId}" was not found.`,
        details: []
      });
    },
    listAvailableModelIds() {
      return [];
    }
  };
}
