import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

import {
  collectDoctorReport,
  type DoctorReport
} from "../../cli/commands/doctor.js";
import {
  collectModelsReport,
  renderModelsReport,
  type ModelsReport
} from "../../cli/commands/models.js";
import {
  collectRevisionConfigReport,
  renderRevisionInstructionReport,
  renderRevisionConfigReport,
  type RevisionConfigReport
} from "../../cli/commands/revision.js";
import {
  isMarkdownFilePath,
  resolvePathFromCwd,
  saveUraniborgConfig
} from "../../config/index.js";
import {
  createNodeFeynmanInteractiveLauncher
} from "../../review/feynman-remediation.js";
import {
  launchFeynmanRemediationAction,
  type FeynmanRemediationAction
} from "../../review/index.js";
import { FooterHelp, MenuList, Section } from "../components.js";
import { useExternalFlowController } from "../external-flow.js";
import { useReloadableAsyncValue } from "../hooks.js";

type ConfigSectionId =
  | "review-runtime"
  | "alphaxiv"
  | "web-search"
  | "revision-provider"
  | "revision-prompt";

interface ConfigScreenSnapshot {
  doctorReport: DoctorReport;
  modelsReport: ModelsReport;
  revisionReport: RevisionConfigReport;
}

export function RevisionConfigScreen(props: {
  onRevisionSetupRequested?: (() => void) | undefined;
  loadSnapshot?: () => Promise<ConfigScreenSnapshot>;
  saveConfig?: typeof saveUraniborgConfig;
  cwd?: string | undefined;
}): React.JSX.Element {
  const [selection, setSelection] = useState(0);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptPathDraft, setPromptPathDraft] = useState("");
  const [promptError, setPromptError] = useState<string | undefined>(undefined);
  const externalFlow = useExternalFlowController();
  const snapshotState = useReloadableAsyncValue(
    async () =>
      props.loadSnapshot?.() ??
      collectConfigScreenSnapshot(),
    []
  );

  const items = useMemo(() => {
    if (snapshotState.value === undefined) {
      return [] as readonly {
        id: ConfigSectionId;
        label: string;
        hint: string;
      }[];
    }

    return buildConfigItems(snapshotState.value);
  }, [snapshotState.value]);

  useInput((_input, key) => {
    if (externalFlow.busy) {
      return;
    }

    if (editingPrompt) {
      if (!key.return) {
        return;
      }

      const snapshot = snapshotState.value;

      if (snapshot === undefined) {
        return;
      }

      void saveRevisionPromptPath({
        report: snapshot.revisionReport,
        promptPathDraft,
        cwd: props.cwd ?? process.cwd(),
        saveConfig: props.saveConfig ?? saveUraniborgConfig
      })
        .then(() => {
          setPromptError(undefined);
          setEditingPrompt(false);
          void snapshotState.reload();
        })
        .catch((error: unknown) => {
          setPromptError(
            error instanceof Error
              ? error.message
              : "Revision prompt could not be saved."
          );
        });
      return;
    }

    if (key.upArrow && selection > 0) {
      setSelection((current) => current - 1);
      return;
    }

    if (key.downArrow && selection < items.length - 1) {
      setSelection((current) => current + 1);
      return;
    }

    if (!key.return) {
      return;
    }

    const snapshot = snapshotState.value;
    const selectedItem = items[selection];

    if (snapshot === undefined || selectedItem === undefined) {
      return;
    }

    if (selectedItem.id === "revision-provider") {
      props.onRevisionSetupRequested?.();
      return;
    }

    if (selectedItem.id === "revision-prompt") {
      const configuredPath =
        snapshot.revisionReport.parsedConfigResult.ok
          ? snapshot.revisionReport.parsedConfigResult.value.revision
              .instructionPrompt?.sourceFile ?? ""
          : "";

      setPromptPathDraft(configuredPath);
      setPromptError(undefined);
      setEditingPrompt(true);
      return;
    }

    const action = resolveConfigAction(snapshot.doctorReport, selectedItem.id);

    if (action === undefined) {
      return;
    }

    void externalFlow.runFlow({
      startingStatus: `Launching ${selectedItem.label} action…`,
      async run() {
        return launchConfigAction(snapshot.doctorReport, action);
      },
      onRefresh: snapshotState.reload
    });
  });

  if (snapshotState.loading) {
    return <Text>Loading config…</Text>;
  }

  if (snapshotState.error !== undefined) {
    return <Text color="red">{snapshotState.error}</Text>;
  }

  const snapshot = snapshotState.value;

  if (snapshot === undefined) {
    return <Text color="red">Config state could not be loaded.</Text>;
  }

  const selectedItem = items[selection] ?? items[0];

  if (selectedItem === undefined) {
    return <Text color="red">No config sections are available.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Section title="Config Sections">
        <MenuList
          items={items}
          selectedId={selectedItem.id}
        />
      </Section>
      <Section title={selectedItem.label}>
        {selectedItem.id === "revision-prompt" && editingPrompt ? (
          <Box flexDirection="column">
            <TextInput value={promptPathDraft} onChange={setPromptPathDraft} />
            <Text color="gray">
              Enter a Markdown file path. Leave empty to use Uraniborg&apos;s default revision guidance.
            </Text>
          </Box>
        ) : (
          renderConfigSection(snapshot, selectedItem.id).map((line, index) => (
            <Text key={`${selectedItem.id}:${index}:${line}`}>{line}</Text>
          ))
        )}
      </Section>
      {externalFlow.status === undefined ? null : (
        <Text color="yellow">{externalFlow.status}</Text>
      )}
      {externalFlow.error === undefined ? null : (
        <Text color="red">{externalFlow.error}</Text>
      )}
      {promptError === undefined ? null : (
        <Text color="red">{promptError}</Text>
      )}
      <FooterHelp
        text={
          editingPrompt
            ? "Type Markdown path • Enter save • Leave empty to clear"
            : "↑/↓ choose section • Enter open or configure"
        }
      />
    </Box>
  );
}

async function collectConfigScreenSnapshot(): Promise<ConfigScreenSnapshot> {
  const [doctorReport, modelsReport, revisionReport] = await Promise.all([
    collectDoctorReport(),
    collectModelsReport(),
    collectRevisionConfigReport({})
  ]);

  return {
    doctorReport,
    modelsReport,
    revisionReport
  };
}

function buildConfigItems(snapshot: ConfigScreenSnapshot): readonly {
  id: ConfigSectionId;
  label: string;
  hint: string;
}[] {
  return [
    {
      id: "review-runtime",
      label: "Review Runtime",
      hint: summarizeReviewRuntime(snapshot.modelsReport)
    },
    {
      id: "alphaxiv",
      label: "AlphaXiv",
      hint: summarizeRecommendedCheck(snapshot.doctorReport, "alphaxiv")
    },
    {
      id: "web-search",
      label: "Web Search",
      hint: summarizeRecommendedCheck(snapshot.doctorReport, "web_search")
    },
    {
      id: "revision-provider",
      label: "Revision Provider",
      hint: summarizeRevisionConfig(snapshot.revisionReport)
    },
    {
      id: "revision-prompt",
      label: "Revision Prompt",
      hint: summarizeRevisionPrompt(snapshot.revisionReport)
    }
  ];
}

function renderConfigSection(
  snapshot: ConfigScreenSnapshot,
  sectionId: ConfigSectionId
): readonly string[] {
  switch (sectionId) {
    case "review-runtime":
      return [
        ...extractSection(renderModelsReport(snapshot.modelsReport), "Review Runtime"),
        "",
        renderActionHint(
          resolveConfigAction(snapshot.doctorReport, sectionId),
          "No direct review-runtime remediation is currently required."
        )
      ];
    case "alphaxiv":
      return [
        ...renderRecommendedCheck(snapshot.doctorReport, "alphaxiv"),
        "",
        renderActionHint(
          resolveConfigAction(snapshot.doctorReport, sectionId),
          "No AlphaXiv action is currently required."
        )
      ];
    case "web-search":
      return [
        ...renderRecommendedCheck(snapshot.doctorReport, "web_search"),
        "",
        renderActionHint(
          resolveConfigAction(snapshot.doctorReport, sectionId),
          "No web-search action is currently required."
        )
      ];
    case "revision-provider":
      return [
        ...renderRevisionConfigReport(snapshot.revisionReport),
        "",
        "Press Enter to open revision provider setup."
      ];
    case "revision-prompt":
      return [
        ...renderRevisionInstructionReport(snapshot.revisionReport),
        "",
        "Press Enter to set, replace, or clear the custom revision prompt path."
      ];
  }
}

function extractSection(
  lines: readonly string[],
  sectionTitle: string
): readonly string[] {
  const startIndex = lines.findIndex((line) => line === sectionTitle);

  if (startIndex < 0) {
    return [];
  }

  const collected: string[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (line === undefined || line === "") {
      break;
    }

    collected.push(line);
  }

  return collected;
}

function summarizeReviewRuntime(report: ModelsReport): string {
  const readiness = report.readinessReport.requiredReady;

  if (!report.runtimeStatus.ready) {
    return "action required";
  }

  return readiness ? "ready" : "attention needed";
}

function summarizeRecommendedCheck(
  report: DoctorReport,
  code: "alphaxiv" | "web_search"
): string {
  const check = report.readinessReport.checks.find(
    (entry) => entry.code === code
  );

  if (check === undefined) {
    return "unknown";
  }

  return check.ready ? "ready" : "not configured";
}

function summarizeRevisionConfig(report: RevisionConfigReport): string {
  if (report.readinessResult.ok) {
    return "ready";
  }

  return report.parsedConfigResult.ok ? "incomplete" : "missing";
}

function summarizeRevisionPrompt(report: RevisionConfigReport): string {
  if (!report.parsedConfigResult.ok) {
    return "unavailable";
  }

  const configuredPath = report.parsedConfigResult.value.revision.instructionPrompt;

  if (configuredPath === undefined) {
    return "default";
  }

  return report.readinessResult.ok ||
    report.readinessResult.error.code !== "revision_instruction_prompt_unreadable"
    ? "custom file"
    : "action required";
}

function renderRecommendedCheck(
  report: DoctorReport,
  code: "alphaxiv" | "web_search"
): readonly string[] {
  const check = report.readinessReport.checks.find(
    (entry) => entry.code === code
  );

  if (check === undefined) {
    return ["Status is unavailable."];
  }

  return [check.summary, ...selectVisibleConfigDetails(code, check.details)];
}

function renderActionHint(
  action: FeynmanRemediationAction | undefined,
  fallback: string
): string {
  return action === undefined
    ? fallback
    : "Press Enter to launch the relevant configuration action.";
}

function resolveConfigAction(
  report: DoctorReport,
  sectionId: Exclude<ConfigSectionId, "revision-provider" | "revision-prompt">
): FeynmanRemediationAction | undefined {
  if (sectionId === "review-runtime") {
    return report.readinessReport.checks.find(
      (check) =>
        (check.code === "runtime" || check.code === "review_models") &&
        check.remediation !== undefined
    )?.remediation;
  }

  if (sectionId === "alphaxiv") {
    return report.readinessReport.checks.find(
      (check) => check.code === "alphaxiv"
    )?.remediation;
  }

  const action = report.readinessReport.checks.find(
    (check) => check.code === "web_search"
  )?.remediation;

  return normalizeConfigAction(action);
}

async function saveRevisionPromptPath(input: {
  report: RevisionConfigReport;
  promptPathDraft: string;
  cwd: string;
  saveConfig: typeof saveUraniborgConfig;
}): Promise<void> {
  if (!input.report.parsedConfigResult.ok) {
    throw new Error(
      "Configure the revision provider first before setting a custom revision prompt."
    );
  }

  const trimmedDraft = input.promptPathDraft.trim();
  const nextPrompt =
    trimmedDraft.length === 0
      ? undefined
      : {
          sourceFile: resolvePathFromCwd(trimmedDraft, input.cwd)
        };

  if (
    nextPrompt !== undefined &&
    !isMarkdownFilePath(nextPrompt.sourceFile)
  ) {
    throw new Error("Revision prompt must point to a Markdown file.");
  }

  const currentConfig = input.report.parsedConfigResult.value;
  const nextRevision =
    nextPrompt === undefined
      ? {
          profile: currentConfig.revision.profile,
          auth: currentConfig.revision.auth,
          credentialBinding: currentConfig.revision.credentialBinding,
          ...(currentConfig.revision.providerContext === undefined
            ? {}
            : {
                providerContext: currentConfig.revision.providerContext
              }),
          endpoint: currentConfig.revision.endpoint,
          defaults: currentConfig.revision.defaults
        }
      : {
          ...currentConfig.revision,
          instructionPrompt: nextPrompt
        };

  await input.saveConfig(input.report.configFilePath, {
    ...currentConfig,
    revision: nextRevision
  });
}

function normalizeConfigAction(
  action: FeynmanRemediationAction | undefined
): FeynmanRemediationAction | undefined {
  return action?.kind === "search_configure" && action.provider === undefined
    ? {
        ...action,
        provider: "auto"
      }
    : action;
}

function selectVisibleConfigDetails(
  code: "alphaxiv" | "web_search",
  details: readonly string[]
): readonly string[] {
  if (code === "alphaxiv") {
    const stdout = readCollapsedStdout(details);

    if (stdout === undefined) {
      return [];
    }

    const match = /alphaXiv logged in as (.+)$/u.exec(stdout);

    return match === null ? [] : [`Logged in as ${match[1]}.`];
  }

  const stdout = readCollapsedStdout(details);

  if (stdout === undefined) {
    return [];
  }

  const visible: string[] = [];

  const managedBy = readLabeledField(stdout, "Managed by");
  if (managedBy !== undefined) {
    visible.push(`Managed by: ${managedBy}`);
  }

  const searchRoute = readLabeledField(stdout, "Search route");
  if (searchRoute !== undefined) {
    visible.push(`Search route: ${searchRoute}`);
  }

  const requestRoute = readLabeledField(stdout, "Request route");
  if (requestRoute !== undefined) {
    visible.push(`Request route: ${requestRoute}`);
  }

  const browserProfile = readLabeledField(stdout, "Browser profile");
  if (browserProfile !== undefined) {
    visible.push(`Browser profile: ${browserProfile}`);
  }

  const configPath = readLabeledField(stdout, "Config path");
  if (configPath !== undefined) {
    visible.push(`Config path: ${configPath}`);
  }

  return visible;
}

function readCollapsedStdout(details: readonly string[]): string | undefined {
  const stdoutLine = details.find((detail) => detail.startsWith("stdout: "));

  return stdoutLine?.slice("stdout: ".length).trim();
}

function readLabeledField(
  text: string,
  label: string
): string | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(
    `${escapedLabel}:\\s*(.+?)(?=\\s+[A-Z][A-Za-z ]+:|$)`,
    "u"
  ).exec(text);

  const value = match?.[1]?.trim();

  return value === undefined || value.length === 0 ? undefined : value;
}

async function launchConfigAction(
  report: DoctorReport,
  action: FeynmanRemediationAction
): Promise<
  | {
      kind: "success";
      message: string;
      refresh?: boolean | undefined;
    }
  | {
      kind: "failed";
      message: string;
    }
> {
  if (report.runtimeStatus.executablePath === undefined) {
    return {
      kind: "failed",
      message: "Feynman executable path is unavailable for configuration launch."
    };
  }

  const result = await launchFeynmanRemediationAction(
    report.runtimeStatus.executablePath,
    action,
    createNodeFeynmanInteractiveLauncher()
  );

  if (result.exitCode === 0) {
    return {
      kind: "success",
      message: "Configuration action completed. Refreshing state…",
      refresh: true
    };
  }

  return {
    kind: "failed",
    message: `Configuration action exited with code ${result.exitCode}.`
  };
}
