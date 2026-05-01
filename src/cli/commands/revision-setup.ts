import {
  cancel,
  intro,
  isCancel,
  outro,
  select,
  text
} from "@clack/prompts";

import {
  createNodeRevisionBrowserLauncher,
  createRevisionAuthClient,
  ensureUraniborgAppHome,
  loadSetupSeedUraniborgConfig,
  resolveUraniborgPaths,
  saveUraniborgConfig,
  type RevisionAuthClient,
  type RevisionBrowserLauncher
} from "../../config/index.js";
import {
  getRevisionProfile,
  getRevisionProfileOptions,
  type UraniborgRevisionAuthStrategy,
  type UraniborgRevisionProfileId
} from "../../config/revision-profiles.js";
import type {
  UraniborgConfig,
  UraniborgRevisionCredentialBinding
} from "../../types/app-config.js";
import { writeInfo } from "../../ui/output.js";

export interface RevisionSetupPrompts {
  intro: typeof intro;
  outro: typeof outro;
  cancel: typeof cancel;
  select: typeof select;
  text: typeof text;
  isCancel: typeof isCancel;
}

export interface RevisionSetupDependencies {
  resolvePaths?: typeof resolveUraniborgPaths;
  ensureAppHome?: typeof ensureUraniborgAppHome;
  loadConfig?: typeof loadSetupSeedUraniborgConfig;
  saveConfig?: typeof saveUraniborgConfig;
  prompts?: RevisionSetupPrompts;
  authClient?: RevisionAuthClient;
  browserLauncher?: RevisionBrowserLauncher;
  writeLine?: (message: string) => void;
}

interface RevisionCredentialSetupResult {
  credentialBinding: UraniborgRevisionCredentialBinding;
  providerContext?: UraniborgConfig["revision"]["providerContext"];
}

export const BROWSER_LOGIN_STRATEGY: UraniborgRevisionAuthStrategy = {
  authClass: "oauth",
  acquisition: "browser-login",
  guided: true
};

export async function runGuidedRevisionSetup(
  dependencies: RevisionSetupDependencies = {}
): Promise<void> {
  const resolvePaths = dependencies.resolvePaths ?? resolveUraniborgPaths;
  const ensureAppHome = dependencies.ensureAppHome ?? ensureUraniborgAppHome;
  const loadConfig = dependencies.loadConfig ?? loadSetupSeedUraniborgConfig;
  const saveConfig = dependencies.saveConfig ?? saveUraniborgConfig;
  const authClient = dependencies.authClient ?? createRevisionAuthClient();
  const browserLauncher =
    dependencies.browserLauncher ?? createNodeRevisionBrowserLauncher();
  const writeLine = dependencies.writeLine ?? writeInfo;
  const prompts = dependencies.prompts ?? {
    intro,
    outro,
    cancel,
    select,
    text,
    isCancel
  };
  const paths = resolvePaths();
  await ensureAppHome(paths);

  const existingConfig = await loadExistingConfig(paths.configFile, loadConfig);
  const initialConfig = existingConfig ?? createDefaultConfig();

  prompts.intro("Uraniborg revision setup");

  const profileId = await promptRevisionProfile(
    initialConfig.revision.profile.id,
    prompts
  );
  const credentialResult = await setupRevisionCredentialBinding(
    profileId,
    initialConfig,
    prompts,
    authClient,
    browserLauncher,
    writeLine
  );
  const defaultModel = await promptText(
    {
      message: "Default revision model",
      initialValue:
        initialConfig.revision.profile.id === profileId
          ? initialConfig.revision.defaults.model
          : getRevisionProfile(profileId).defaultModel,
      validate(value) {
        return value.trim().length > 0
          ? undefined
          : "Enter the default revision model name.";
      }
    },
    prompts
  );

  const profile = getRevisionProfile(profileId);
  const nextConfig: UraniborgConfig = createConfig({
    profileId,
    credentialBinding: credentialResult.credentialBinding,
    timeoutMs: initialConfig.revision.endpoint.timeoutMs,
    providerContext: credentialResult.providerContext,
    defaults: {
      model: defaultModel,
      temperature: initialConfig.revision.defaults.temperature,
      ...(typeof initialConfig.revision.defaults.maxOutputTokens === "number"
        ? {
            maxOutputTokens: initialConfig.revision.defaults.maxOutputTokens
          }
        : {})
    }
  });

  await saveConfig(paths.configFile, nextConfig);
  prompts.outro(
    `Saved Uraniborg revision config for ${profile.label} to ${paths.configFile}`
  );
}

export async function loadExistingConfig(
  configFilePath: string,
  loadConfig: typeof loadSetupSeedUraniborgConfig
): Promise<UraniborgConfig | null> {
  const result = await loadConfig(configFilePath);

  if (result.ok) {
    return result.value;
  }

  if (
    result.error.code === "config_not_found" ||
    result.error.code === "config_stale_revision_setup"
  ) {
    return null;
  }

  throw new Error(result.error.message);
}

export function createDefaultConfig(): UraniborgConfig {
  const profile = getRevisionProfile("openai-codex-chatgpt");

  return createConfig({
    profileId: profile.id,
    credentialBinding: {
      type: "pi-auth-storage",
      providerId: profile.piProviderId
    },
    timeoutMs: 60000,
    defaults: {
      model: profile.defaultModel,
      temperature: 0.2
    }
  });
}

export function createConfig(options: {
  profileId: UraniborgRevisionProfileId;
  credentialBinding: UraniborgRevisionCredentialBinding;
  timeoutMs: number;
  defaults: UraniborgConfig["revision"]["defaults"];
  providerContext?: UraniborgConfig["revision"]["providerContext"];
}): UraniborgConfig {
  const profile = getRevisionProfile(options.profileId);

  return {
    version: 3,
    revision: {
      profile: {
        id: profile.id,
        family: profile.family,
        label: profile.label
      },
      auth: {
        class: BROWSER_LOGIN_STRATEGY.authClass,
        acquisition: BROWSER_LOGIN_STRATEGY.acquisition
      },
      credentialBinding: options.credentialBinding,
      ...(options.providerContext === undefined
        ? {}
        : {
            providerContext: options.providerContext
          }),
      endpoint: {
        baseUrl: profile.canonicalBaseUrl,
        timeoutMs: options.timeoutMs
      },
      defaults: options.defaults
    },
    refine: {
      endpoint: {
        baseUrl: profile.canonicalBaseUrl,
        timeoutMs: options.timeoutMs
      },
      defaults: options.defaults
    }
  };
}

async function promptText(
  options: {
    message: string;
    initialValue: string;
    validate: (value: string) => string | undefined;
  },
  prompts: RevisionSetupPrompts
): Promise<string> {
  const response = await prompts.text({
    message: options.message,
    defaultValue: options.initialValue,
    validate: options.validate
  });

  if (prompts.isCancel(response)) {
    prompts.cancel("Uraniborg revision setup cancelled.");
    throw new Error("Uraniborg revision setup cancelled.");
  }

  return response;
}

async function promptRevisionProfile(
  initialProfileId: UraniborgRevisionProfileId,
  prompts: RevisionSetupPrompts
): Promise<UraniborgRevisionProfileId> {
  const response = await prompts.select({
    message: "Which revision provider profile should Uraniborg use?",
    options: getRevisionProfileOptions().map((profile) => ({
      value: profile.id,
      label: profile.label,
      hint: profile.canonicalBaseUrl
    })),
    initialValue: initialProfileId
  });

  if (prompts.isCancel(response)) {
    prompts.cancel("Uraniborg revision setup cancelled.");
    throw new Error("Uraniborg revision setup cancelled.");
  }

  return response;
}

async function setupRevisionCredentialBinding(
  profileId: UraniborgRevisionProfileId,
  initialConfig: UraniborgConfig,
  prompts: RevisionSetupPrompts,
  authClient: RevisionAuthClient,
  browserLauncher: RevisionBrowserLauncher,
  writeLine: (message: string) => void
): Promise<RevisionCredentialSetupResult> {
  const profile = getRevisionProfile(profileId);
  const loginResult = await authClient.loginManagedCredential(
    profile.piProviderId,
    {
      onAuth: (info) => {
        writeLine(
          info.instructions ??
            `Complete the ${profile.label} login flow in your browser.`
        );

        void browserLauncher.open(info.url).catch(() => {
          writeLine(`Open this URL to continue login: ${info.url}`);
        });
        writeLine(`${profile.label} login URL: ${info.url}`);
      },
      onPrompt: async (prompt) =>
        promptText(
          {
            message: prompt.message,
            initialValue: "",
            validate(value) {
              return value.trim().length > 0
                ? undefined
                : "Paste the authorization code or redirect URL.";
            }
          },
          prompts
        ),
      onProgress: (message) => {
        writeLine(message);
      }
    }
  );

  const providerContext =
    profileId === "openai-codex-chatgpt"
      ? loginResult.accountId === undefined
        ? undefined
        : {
            accountId: loginResult.accountId
          }
      : profileId === "gemini-cloud-code-assist"
        ? loginResult.projectId === undefined
          ? undefined
          : {
              projectId: loginResult.projectId
            }
        : undefined;

  for (const requiredField of profile.requiredProviderContext) {
    const initialValue =
      initialConfig.revision.profile.id === profileId
        ? initialConfig.revision.providerContext?.[requiredField]
        : undefined;
    const fieldValue = providerContext?.[requiredField] ?? initialValue;

    if (typeof fieldValue !== "string" || fieldValue.length === 0) {
      throw new Error(
        `Pi login for "${profile.piProviderId}" did not produce the required provider context "${requiredField}".`
      );
    }
  }

  return {
    credentialBinding: {
      type: "pi-auth-storage",
      providerId: loginResult.providerId
    },
    ...(providerContext === undefined ? {} : { providerContext })
  };
}
