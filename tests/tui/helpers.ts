import type { UraniborgAppHomeStatus } from "../../src/config/index.js";
import { createConfig } from "../../src/cli/commands/revision-setup.js";
import { getRevisionProfile } from "../../src/config/revision-profiles.js";
import type { FeynmanReadinessReport } from "../../src/review/index.js";
import type { FeynmanRuntimeStatus } from "../../src/review/index.js";
import type {
  ResolvedUraniborgConfig,
  UraniborgConfig
} from "../../src/types/app-config.js";

export async function flushInk(frames = 3): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

export function createPaths() {
  return {
    homeDirectory: "/tmp/alice",
    appHomeDirectory: "/tmp/alice/.uraniborg",
    configFile: "/tmp/alice/.uraniborg/config.json",
    vendorDirectory: "/tmp/alice/.uraniborg/vendor",
    feynmanRuntimeDirectory: "/tmp/alice/.uraniborg/vendor/feynman",
    feynmanRuntimeManifestFile: "/tmp/alice/.uraniborg/vendor/feynman/runtime.json",
    runsDirectory: "/tmp/alice/.uraniborg/runs"
  };
}

export function createAppHomeStatus(): UraniborgAppHomeStatus {
  const paths = createPaths();

  return {
    paths,
    appHome: {
      kind: "directory",
      path: paths.appHomeDirectory
    },
    vendor: {
      kind: "directory",
      path: paths.vendorDirectory
    },
    feynmanRuntime: {
      kind: "directory",
      path: paths.feynmanRuntimeDirectory
    },
    runs: {
      kind: "directory",
      path: paths.runsDirectory
    },
    isLayoutValid: true
  };
}

export function createReadyRuntimeStatus(): FeynmanRuntimeStatus {
  return {
    ready: true,
    code: "ready",
    executablePath: "/tmp/alice/.local/bin/feynman",
    detectedVersion: "1.2.3",
    warnings: [],
    candidates: [
      {
        executablePath: "/tmp/alice/.local/bin/feynman",
        compatible: true,
        detectedVersion: "1.2.3",
        details: ["Version: 1.2.3"]
      }
    ]
  };
}

export function createReadyReadinessReport(options?: {
  reviewModels?: readonly string[];
}): FeynmanReadinessReport {
  const reviewModels = options?.reviewModels ?? ["openai-codex/gpt-5.2"];

  return {
    checks: [
      {
        code: "runtime",
        tier: "required",
        ready: true,
        summary: "Compatible Feynman runtime is ready at /tmp/alice/.local/bin/feynman.",
        details: ["Version: 1.2.3"]
      },
      {
        code: "review_models",
        tier: "required",
        ready: true,
        summary: `Review model discovery is ready with ${reviewModels.length} available model${reviewModels.length === 1 ? "" : "s"}.`,
        details: [`Models: ${reviewModels.join(", ")}`]
      },
      {
        code: "alphaxiv",
        tier: "recommended",
        ready: true,
        summary: "AlphaXiv is ready.",
        details: []
      },
      {
        code: "web_search",
        tier: "recommended",
        ready: true,
        summary: "Web search is ready.",
        details: []
      }
    ],
    requiredReady: true,
    recommendedReady: true,
    reviewModels
  };
}

export function createBrowserConfig(options?: {
  profileId?: "openai-codex-chatgpt" | "claude-browser" | "gemini-cloud-code-assist";
  model?: string;
}): UraniborgConfig {
  const profileId = options?.profileId ?? "openai-codex-chatgpt";
  const profile = getRevisionProfile(profileId);

  return createConfig({
    profileId,
    credentialBinding: {
      type: "pi-auth-storage",
      providerId: profile.piProviderId
    },
    timeoutMs: 60000,
    defaults: {
      model: options?.model ?? profile.defaultModel,
      temperature: 0.2
    }
  });
}

export function createResolvedBrowserConfig(options?: {
  profileId?: "openai-codex-chatgpt" | "claude-browser" | "gemini-cloud-code-assist";
  model?: string;
}): ResolvedUraniborgConfig {
  const config = createBrowserConfig(options);

  return {
    ...config,
    revision: {
      ...config.revision,
      runtime: {
        kind: "pi-managed",
        providerId: config.revision.credentialBinding.providerId
      }
    }
  };
}
