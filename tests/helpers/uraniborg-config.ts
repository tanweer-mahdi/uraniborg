import { getRevisionProfile } from "../../src/config/revision-profiles.js";
import type {
  ResolvedUraniborgConfig,
  UraniborgConfig,
  UraniborgRevisionCredentialBinding,
  UraniborgRevisionDefaults
} from "../../src/types/app-config.js";

export function createTestUraniborgConfig(options: {
  profileId:
    | "openai-codex-chatgpt"
    | "claude-browser"
    | "gemini-cloud-code-assist"
    | "manual-openai-compatible"
    | "claude-api"
    | "gemini-direct"
    ;
  credentialBinding: UraniborgRevisionCredentialBinding;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  baseUrl?: string;
  providerContext?: UraniborgConfig["revision"]["providerContext"];
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
  const baseUrl =
    options.baseUrl ??
    (profile.allowsEndpointOverride
      ? "https://api.example.com/v1"
      : profile.canonicalBaseUrl);

  return {
    version: 3,
    revision: {
      profile: {
        id: profile.id,
        family: profile.family,
        label: profile.label
      },
      auth: inferAuth(profile.id, options.credentialBinding),
      credentialBinding: options.credentialBinding,
      ...(options.providerContext === undefined
        ? {}
        : {
            providerContext: options.providerContext
          }),
      endpoint: {
        baseUrl,
        overrideAllowed: profile.allowsEndpointOverride,
        timeoutMs: options.timeoutMs ?? 60000
      },
      defaults
    },
    refine: {
      endpoint: {
        baseUrl,
        timeoutMs: options.timeoutMs ?? 60000,
        ...deriveCompatibilitySecretFields(options.credentialBinding)
      },
      defaults
    }
  };
}

export function createResolvedTestUraniborgConfig(options: {
  profileId:
    | "openai-codex-chatgpt"
    | "claude-browser"
    | "gemini-cloud-code-assist"
    | "manual-openai-compatible"
    | "claude-api"
    | "gemini-direct"
    ;
  binding:
    | {
        type: "stored-secret";
        apiKey: string;
      }
    | {
        type: "env-var";
        envVar: string;
        resolvedApiKey: string;
      }
    | {
        type: "pi-auth-storage";
        providerId: string;
      };
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  baseUrl?: string;
  providerContext?: UraniborgConfig["revision"]["providerContext"];
}): ResolvedUraniborgConfig {
  const config = createTestUraniborgConfig({
    profileId: options.profileId,
    credentialBinding:
      options.binding.type === "stored-secret"
        ? {
            type: "stored-secret",
            apiKey: options.binding.apiKey
          }
        : options.binding.type === "env-var"
          ? {
              type: "env-var",
              envVar: options.binding.envVar
            }
          : {
              type: "pi-auth-storage",
              providerId: options.binding.providerId
            },
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
    ...(typeof options.baseUrl === "string"
      ? {
          baseUrl: options.baseUrl
        }
      : {}),
    ...(options.providerContext === undefined
      ? {}
      : {
          providerContext: options.providerContext
        })
  });

  return {
    ...config,
    revision: {
      ...config.revision,
      runtime:
        options.binding.type === "pi-auth-storage"
          ? {
              kind: "pi-managed",
              providerId: options.binding.providerId
            }
          : {
              kind: "manual-compatible",
              apiKey:
                options.binding.type === "stored-secret"
                  ? options.binding.apiKey
                  : options.binding.resolvedApiKey
            }
    },
    refine: {
      ...config.refine,
      endpoint: {
        ...config.refine.endpoint,
        ...(options.binding.type === "pi-auth-storage"
          ? {}
          : {
              apiKey:
                options.binding.type === "stored-secret"
                  ? options.binding.apiKey
                  : options.binding.resolvedApiKey
            })
      }
    }
  };
}

function inferAuth(
  profileId: UraniborgConfig["revision"]["profile"]["id"],
  credentialBinding: UraniborgRevisionCredentialBinding
): UraniborgConfig["revision"]["auth"] {
  if (credentialBinding.type === "pi-auth-storage") {
    return {
      class: "oauth",
      acquisition: "browser-login"
    };
  }

  if (credentialBinding.type === "adc") {
    return {
      class: "adc",
      acquisition: "ambient"
    };
  }

  if (credentialBinding.type === "env-var") {
    return {
      class: "api-key",
      acquisition: "env-var"
    };
  }

  return {
    class: "api-key",
    acquisition: "prompt-secret"
  };
}

function deriveCompatibilitySecretFields(
  credentialBinding: UraniborgRevisionCredentialBinding
): Partial<{
  apiKey: string;
  apiKeyEnvVar: string;
}> {
  switch (credentialBinding.type) {
    case "stored-secret":
      return {
        apiKey: credentialBinding.apiKey
      };
    case "env-var":
      return {
        apiKeyEnvVar: credentialBinding.envVar
      };
    default:
      return {};
  }
}
