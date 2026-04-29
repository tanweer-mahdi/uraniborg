export type UraniborgRevisionProfileId =
  | "openai-codex-chatgpt"
  | "claude-browser"
  | "gemini-cloud-code-assist"
  | "manual-openai-compatible"
  | "claude-api"
  | "gemini-direct"
  ;

export type UraniborgRevisionProviderFamily =
  | "openai-codex"
  | "claude"
  | "gemini"
  | "openai-compatible";

export type UraniborgRevisionAuthClass = "api-key" | "oauth" | "adc";

export type UraniborgRevisionAuthAcquisition =
  | "prompt-secret"
  | "env-var"
  | "browser-login"
  | "ambient";

export interface UraniborgRevisionAuthStrategy {
  authClass: UraniborgRevisionAuthClass;
  acquisition: UraniborgRevisionAuthAcquisition;
  guided: boolean;
}

export interface UraniborgRevisionProfile {
  id: UraniborgRevisionProfileId;
  label: string;
  family: UraniborgRevisionProviderFamily;
  canonicalBaseUrl: string;
  allowsEndpointOverride: boolean;
  requiredProviderContext: readonly ("accountId" | "projectId")[];
  authStrategies: readonly UraniborgRevisionAuthStrategy[];
  piProviderId?: string | undefined;
  defaultModel: string;
  deprecated: boolean;
}

const REVISION_PROFILES: readonly UraniborgRevisionProfile[] = [
  {
    id: "openai-codex-chatgpt",
    label: "OpenAI/Codex",
    family: "openai-codex",
    canonicalBaseUrl: "https://chatgpt.com/backend-api",
    allowsEndpointOverride: false,
    requiredProviderContext: ["accountId"],
    authStrategies: [
      {
        authClass: "oauth",
        acquisition: "browser-login",
        guided: true
      }
    ],
    piProviderId: "openai-codex",
    defaultModel: "gpt-5.4",
    deprecated: false
  },
  {
    id: "claude-browser",
    label: "Claude",
    family: "claude",
    canonicalBaseUrl: "https://api.anthropic.com",
    allowsEndpointOverride: false,
    requiredProviderContext: [],
    authStrategies: [
      {
        authClass: "oauth",
        acquisition: "browser-login",
        guided: true
      }
    ],
    piProviderId: "anthropic",
    defaultModel: "claude-sonnet-4-5",
    deprecated: false
  },
  {
    id: "gemini-cloud-code-assist",
    label: "Gemini",
    family: "gemini",
    canonicalBaseUrl: "https://cloudcode-pa.googleapis.com",
    allowsEndpointOverride: false,
    requiredProviderContext: ["projectId"],
    authStrategies: [
      {
        authClass: "oauth",
        acquisition: "browser-login",
        guided: true
      }
    ],
    piProviderId: "google-gemini-cli",
    defaultModel: "gemini-2.5-pro",
    deprecated: false
  },
  {
    id: "manual-openai-compatible",
    label: "Manual OpenAI-compatible",
    family: "openai-compatible",
    canonicalBaseUrl: "",
    allowsEndpointOverride: true,
    requiredProviderContext: [],
    authStrategies: [
      {
        authClass: "api-key",
        acquisition: "prompt-secret",
        guided: true
      },
      {
        authClass: "api-key",
        acquisition: "env-var",
        guided: true
      }
    ],
    defaultModel: "gpt-5.4",
    deprecated: false
  },
  {
    id: "claude-api",
    label: "Claude",
    family: "claude",
    canonicalBaseUrl: "https://api.anthropic.com",
    allowsEndpointOverride: false,
    requiredProviderContext: [],
    authStrategies: [
      {
        authClass: "api-key",
        acquisition: "prompt-secret",
        guided: false
      },
      {
        authClass: "api-key",
        acquisition: "env-var",
        guided: false
      }
    ],
    defaultModel: "claude-sonnet-4-5",
    deprecated: true
  },
  {
    id: "gemini-direct",
    label: "Gemini",
    family: "gemini",
    canonicalBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    allowsEndpointOverride: false,
    requiredProviderContext: [],
    authStrategies: [
      {
        authClass: "api-key",
        acquisition: "prompt-secret",
        guided: false
      },
      {
        authClass: "api-key",
        acquisition: "env-var",
        guided: false
      },
      {
        authClass: "adc",
        acquisition: "ambient",
        guided: false
      }
    ],
    defaultModel: "gemini-2.5-pro",
    deprecated: true
  }
] as const;

export function getRevisionProfile(
  profileId: UraniborgRevisionProfileId
): UraniborgRevisionProfile {
  const profile = REVISION_PROFILES.find((entry) => entry.id === profileId);

  if (profile === undefined) {
    throw new Error(`Unknown revision profile "${profileId}".`);
  }

  return profile;
}

export function getRevisionProfileLabel(
  profileId: UraniborgRevisionProfileId
): string {
  return getRevisionProfile(profileId).label;
}

export function getRevisionProfileOptions(): readonly UraniborgRevisionProfile[] {
  return REVISION_PROFILES.filter((profile) => !profile.deprecated);
}

export function getGuidedRevisionAuthStrategies(
  profileId: UraniborgRevisionProfileId
): readonly UraniborgRevisionAuthStrategy[] {
  return getRevisionProfile(profileId).authStrategies.filter(
    (strategy) => strategy.guided
  );
}

export function supportsRevisionAuthStrategy(
  profile: UraniborgRevisionProfile,
  authClass: UraniborgRevisionAuthClass,
  acquisition: UraniborgRevisionAuthAcquisition
): boolean {
  return profile.authStrategies.some(
    (strategy) =>
      strategy.authClass === authClass && strategy.acquisition === acquisition
  );
}
