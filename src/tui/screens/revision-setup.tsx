import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

import {
  BROWSER_LOGIN_STRATEGY,
  createConfig,
  createDefaultConfig,
  loadExistingConfig
} from "../../cli/commands/revision-setup.js";
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
  type UraniborgRevisionProfileId
} from "../../config/revision-profiles.js";
import type { UraniborgConfig } from "../../types/app-config.js";
import { FooterHelp, MenuList, Section } from "../components.js";
import {
  isExternalFlowCancelled,
  useExternalFlowController
} from "../external-flow.js";

type SetupStep = "profile" | "model" | "login";

export function RevisionSetupScreen(props: {
  loadInitialConfig?: () => Promise<UraniborgConfig>;
  authClient?: RevisionAuthClient;
  browserLauncher?: RevisionBrowserLauncher;
}): React.JSX.Element {
  const [config, setConfig] = useState<UraniborgConfig | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [step, setStep] = useState<SetupStep>("profile");
  const [profileIndex, setProfileIndex] = useState(0);
  const [defaultModel, setDefaultModel] = useState("");
  const externalFlow = useExternalFlowController();

  useEffect(() => {
    void (props.loadInitialConfig?.() ?? loadInitialConfig())
      .then((nextConfig) => {
        const matchingIndex = getRevisionProfileOptions().findIndex(
          (profile) => profile.id === nextConfig.revision.profile.id
        );

        setConfig(nextConfig);
        setProfileIndex(matchingIndex >= 0 ? matchingIndex : 0);
        setDefaultModel(nextConfig.revision.defaults.model);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Revision setup could not be initialized."
        );
      });
  }, []);

  useInput((input, key) => {
    if (externalFlow.busy && externalFlow.pendingPrompt !== null && key.return) {
      externalFlow.submitPrompt();
      return;
    }

    if (externalFlow.busy) {
      return;
    }

    if (step === "profile") {
      if (key.upArrow && profileIndex > 0) {
        setProfileIndex((current) => current - 1);
        return;
      }

      if (key.downArrow && profileIndex < getRevisionProfileOptions().length - 1) {
        setProfileIndex((current) => current + 1);
        return;
      }

      if (key.return) {
        const selectedProfile = getRevisionProfileOptions()[profileIndex];

        if (selectedProfile !== undefined) {
          if (config?.revision.profile.id !== selectedProfile.id) {
            setDefaultModel(selectedProfile.defaultModel);
          }

          setStep("model");
        }
      }

      return;
    }

    if (step === "model" && key.return) {
      if (defaultModel.trim().length > 0) {
        setStep("login");
      } else {
        setError("Enter the default revision model name.");
      }

      return;
    }

    if (step === "login" && key.return) {
      const selectedProfile = getRevisionProfileOptions()[profileIndex];

      if (selectedProfile !== undefined) {
        setError(undefined);
      void externalFlow.runFlow({
        startingStatus: `Starting ${selectedProfile.label} browser login…`,
        async run(helpers) {
          return runManagedLogin({
              profileId: selectedProfile.id,
              defaultModel: defaultModel.trim(),
              instructionPrompt: config?.revision.instructionPrompt,
              authClient: props.authClient ?? createRevisionAuthClient(),
              browserLauncher:
                props.browserLauncher ?? createNodeRevisionBrowserLauncher(),
              appendStatus(line) {
                helpers.appendStatus(line);
              },
              replaceStatus(line) {
                helpers.replaceStatus(line);
              },
              requestPrompt(message) {
                return helpers.requestPrompt(message);
              }
            });
          }
        });
      }
    }
  });

  if (error !== undefined) {
    return <Text color="red">{error}</Text>;
  }

  if (config === null) {
    return <Text>Loading revision setup…</Text>;
  }

  const profiles = getRevisionProfileOptions();
  const selectedProfile = profiles[profileIndex] ?? profiles[0];

  if (selectedProfile === undefined) {
    return <Text color="red">No revision profiles are available.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Section title="Profile">
        <MenuList
          items={profiles.map((profile) => ({
            id: profile.id,
            label: profile.label,
            hint: profile.canonicalBaseUrl
          }))}
          selectedId={selectedProfile.id}
        />
      </Section>
      <Section title="Default Revision Model">
        {step === "model" && !externalFlow.busy ? (
          <TextInput value={defaultModel} onChange={setDefaultModel} />
        ) : (
          <Text>{defaultModel}</Text>
        )}
      </Section>
      <Section title="Setup Status">
        <Text>Profile: {selectedProfile.label}</Text>
        <Text>
          Auth: {BROWSER_LOGIN_STRATEGY.authClass} / {BROWSER_LOGIN_STRATEGY.acquisition}
        </Text>
        {(externalFlow.status?.split("\n") ?? []).map((line, index) => (
          <Text key={`${index}:${line}`}>{line}</Text>
        ))}
        {externalFlow.pendingPrompt === null ? null : (
          <Box flexDirection="column">
            <Text>{externalFlow.pendingPrompt.message}</Text>
            <TextInput
              value={externalFlow.pendingPromptValue}
              onChange={externalFlow.setPendingPromptValue}
            />
          </Box>
        )}
      </Section>
      {externalFlow.error === undefined ? null : (
        <Text color="red">{externalFlow.error}</Text>
      )}
      <FooterHelp
        text={
          externalFlow.busy
            ? "Browser login in progress • Enter submit prompt input when requested"
            : step === "profile"
              ? "↑/↓ choose profile • Enter continue"
              : step === "model"
                ? "Type default model • Enter continue"
                : "Enter start browser login and save config"
        }
      />
    </Box>
  );
}

async function loadInitialConfig(): Promise<UraniborgConfig> {
  const paths = resolveUraniborgPaths();
  await ensureUraniborgAppHome(paths);

  return (
    (await loadExistingConfig(paths.configFile, loadSetupSeedUraniborgConfig)) ??
    createDefaultConfig()
  );
}

async function runManagedLogin(options: {
  profileId: UraniborgRevisionProfileId;
  defaultModel: string;
  instructionPrompt?: UraniborgConfig["revision"]["instructionPrompt"];
  authClient: RevisionAuthClient;
  browserLauncher: RevisionBrowserLauncher;
  appendStatus: (line: string) => void;
  replaceStatus: (line: string) => void;
  requestPrompt: (message: string) => Promise<string>;
}): Promise<
  | {
      kind: "success";
      message?: string | undefined;
    }
  | {
      kind: "cancelled";
      message: string;
    }
  | {
      kind: "failed";
      message: string;
    }
> {
  const paths = resolveUraniborgPaths();
  const profile = getRevisionProfile(options.profileId);

  try {
    const loginResult = await options.authClient.loginManagedCredential(
      profile.piProviderId,
      {
        onAuth: (info) => {
          options.appendStatus(
            info.instructions ??
              `Complete the ${profile.label} login flow in your browser.`
          );
          options.appendStatus(`${profile.label} login URL: ${info.url}`);

          void options.browserLauncher.open(info.url).catch(() => {
            options.appendStatus(`Open this URL manually: ${info.url}`);
          });
        },
        onPrompt: async (prompt) => options.requestPrompt(prompt.message),
        onProgress: (message) => {
          options.appendStatus(message);
        }
      }
    );

    const providerContext =
      options.profileId === "openai-codex-chatgpt"
        ? loginResult.accountId === undefined
          ? undefined
          : { accountId: loginResult.accountId }
        : options.profileId === "gemini-cloud-code-assist"
          ? loginResult.projectId === undefined
            ? undefined
            : { projectId: loginResult.projectId }
          : undefined;

    if (
      profile.requiredProviderContext.includes("accountId") &&
      providerContext?.accountId === undefined
    ) {
      throw new Error(`${profile.label} login did not return the required account context.`);
    }

    if (
      profile.requiredProviderContext.includes("projectId") &&
      providerContext?.projectId === undefined
    ) {
      throw new Error(`${profile.label} login did not return the required project context.`);
    }

    const nextConfig = createConfig({
      profileId: options.profileId,
      credentialBinding: {
        type: "pi-auth-storage",
        providerId: profile.piProviderId
      },
      timeoutMs: 60000,
      providerContext,
      instructionPrompt: options.instructionPrompt,
      defaults: {
        model: options.defaultModel,
        temperature: 0.2
      }
    });

    await saveUraniborgConfig(paths.configFile, nextConfig);
    options.appendStatus(
      `Saved Uraniborg revision config for ${profile.label} to ${paths.configFile}`
    );
    return {
      kind: "success"
    };
  } catch (error) {
    if (isExternalFlowCancelled(error)) {
      return {
        kind: "cancelled",
        message: `${profile.label} browser login cancelled.`
      };
    }

    return {
      kind: "failed",
      message:
        error instanceof Error
          ? error.message
          : `${profile.label} browser login could not be completed.`
    };
  }
}
