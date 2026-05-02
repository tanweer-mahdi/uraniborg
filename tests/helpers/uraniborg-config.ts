import { getRevisionProfile } from "../../src/config/revision-profiles.js";
import type {
  ResolvedUraniborgConfig,
  UraniborgConfig,
  UraniborgRevisionDefaults
} from "../../src/types/app-config.js";

export function createTestUraniborgConfig(options: {
  profileId:
    | "openai-codex-chatgpt"
    | "claude-browser"
    | "gemini-cloud-code-assist";
  credentialBinding?: {
    type: "pi-auth-storage";
    providerId: string;
  };
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  providerContext?: UraniborgConfig["revision"]["providerContext"];
  instructionPrompt?: UraniborgConfig["revision"]["instructionPrompt"];
}): UraniborgConfig {
  const profile = getRevisionProfile(options.profileId);
  const defaults: UraniborgRevisionDefaults = {
    model: options.model,
    temperature: options.temperature ?? 0.2,
    ...(typeof options.maxOutputTokens === "number"
      ? {
          maxOutputTokens: options.maxOutputTokens
        }
      : {})
  };
  const credentialBinding = options.credentialBinding ?? {
    type: "pi-auth-storage" as const,
    providerId: profile.piProviderId
  };

  return {
    version: 3,
    revision: {
      profile: {
        id: profile.id,
        family: profile.family,
        label: profile.label
      },
      auth: {
        class: "oauth",
        acquisition: "browser-login"
      },
      credentialBinding,
      ...(options.providerContext === undefined
        ? {}
        : {
            providerContext: options.providerContext
          }),
      ...(options.instructionPrompt === undefined
        ? {}
        : {
            instructionPrompt: options.instructionPrompt
          }),
      endpoint: {
        baseUrl: profile.canonicalBaseUrl,
        timeoutMs: options.timeoutMs ?? 60000
      },
      defaults
    },
    refine: {
      endpoint: {
        baseUrl: profile.canonicalBaseUrl,
        timeoutMs: options.timeoutMs ?? 60000
      },
      defaults
    }
  };
}

export function createResolvedTestUraniborgConfig(options: {
  profileId:
    | "openai-codex-chatgpt"
    | "claude-browser"
    | "gemini-cloud-code-assist";
  binding: {
    type: "pi-auth-storage";
    providerId: string;
  };
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  providerContext?: UraniborgConfig["revision"]["providerContext"];
  instructionPrompt?: UraniborgConfig["revision"]["instructionPrompt"];
}): ResolvedUraniborgConfig {
  const config = createTestUraniborgConfig({
    profileId: options.profileId,
    credentialBinding: options.binding,
    model: options.model,
    ...(typeof options.temperature === "number"
      ? {
          temperature: options.temperature
        }
      : {}),
    ...(typeof options.maxOutputTokens === "number"
      ? {
          maxOutputTokens: options.maxOutputTokens
        }
      : {}),
    ...(typeof options.timeoutMs === "number"
      ? {
          timeoutMs: options.timeoutMs
        }
      : {}),
    ...(options.providerContext === undefined
      ? {}
      : {
          providerContext: options.providerContext
        }),
    ...(options.instructionPrompt === undefined
      ? {}
      : {
          instructionPrompt: options.instructionPrompt
        })
  });

  return {
    ...config,
    revision: {
      ...config.revision,
      instructionPrompt:
        config.revision.instructionPrompt === undefined
          ? {
              source: "default",
              effectiveInstruction: "Default revision instruction"
            }
          : {
              source: "file",
              configuredPath: config.revision.instructionPrompt.sourceFile,
              effectiveInstruction: "Custom revision instruction"
            },
      runtime: {
        kind: "pi-managed",
        providerId: options.binding.providerId
      }
    }
  };
}
