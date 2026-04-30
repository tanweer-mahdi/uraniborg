export type UraniborgRevisionProfileId =
  | "openai-codex-chatgpt"
  | "claude-browser"
  | "gemini-cloud-code-assist";

export type UraniborgRevisionProviderFamily =
  | "openai-codex"
  | "claude"
  | "gemini";

export type UraniborgRevisionAuthClass = "oauth";

export type UraniborgRevisionAuthAcquisition = "browser-login";

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
  requiredProviderContext: readonly ("accountId" | "projectId")[];
  authStrategies: readonly UraniborgRevisionAuthStrategy[];
  piProviderId: string;
  defaultModel: string;
}

const BROWSER_LOGIN_STRATEGY: UraniborgRevisionAuthStrategy = {
  authClass: "oauth",
  acquisition: "browser-login",
  guided: true
};

const REVISION_PROFILES: readonly UraniborgRevisionProfile[] = [
  {
    id: "openai-codex-chatgpt",
    label: "OpenAI/Codex",
    family: "openai-codex",
    canonicalBaseUrl: "https://chatgpt.com/backend-api",
    requiredProviderContext: ["accountId"],
    authStrategies: [BROWSER_LOGIN_STRATEGY],
    piProviderId: "openai-codex",
    defaultModel: "gpt-5.4"
  },
  {
    id: "claude-browser",
    label: "Claude",
    family: "claude",
    canonicalBaseUrl: "https://api.anthropic.com",
    requiredProviderContext: [],
    authStrategies: [BROWSER_LOGIN_STRATEGY],
    piProviderId: "anthropic",
    defaultModel: "claude-sonnet-4-5"
  },
  {
    id: "gemini-cloud-code-assist",
    label: "Gemini",
    family: "gemini",
    canonicalBaseUrl: "https://cloudcode-pa.googleapis.com",
    requiredProviderContext: ["projectId"],
    authStrategies: [BROWSER_LOGIN_STRATEGY],
    piProviderId: "google-gemini-cli",
    defaultModel: "gemini-2.5-pro"
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
  return REVISION_PROFILES;
}

export function getGuidedRevisionAuthStrategies(
  profileId: UraniborgRevisionProfileId
): readonly UraniborgRevisionAuthStrategy[] {
  return getRevisionProfile(profileId).authStrategies;
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
