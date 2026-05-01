import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

import {
  createRevisionAuthClient,
  ensureUraniborgAppHome,
  isMarkdownFilePath,
  loadUraniborgConfig,
  resolveUraniborgPaths
} from "../../config/index.js";
import {
  collectFeynmanRuntimeSnapshot,
  createNodeFeynmanCommandRunner,
  createSerializedFeynmanCommandRunner,
  getFeynmanAlphaStatus,
  getFeynmanSearchStatus,
  inspectFeynmanRuntime,
  listFeynmanModels
} from "../../review/index.js";
import type { ResolvedUraniborgConfig } from "../../types/app-config.js";
import { resolveInteractiveReadinessState, type InteractiveReadinessState } from "../../ui/interactive.js";
import { FooterHelp, MenuList, Section, StatusLine } from "../components.js";
import { useReloadableAsyncValue } from "../hooks.js";

type RunSetupStep = "source" | "iterations" | "review-model" | "refine-model" | "launch";

interface RunSetupSnapshot {
  state: InteractiveReadinessState;
  requiredIssues: readonly string[];
  warnings: readonly string[];
  reviewModels: readonly string[];
  refineModels: readonly string[];
  config?: ResolvedUraniborgConfig | undefined;
}
export type { RunSetupSnapshot };

export interface RunLaunchRequest {
  sourcePath: string;
  iterations: number;
  reviewModel: string;
  refineModel: string;
}

const MIN_ITERATIONS = 1;
const MAX_ITERATIONS = 10;

export function RunSetupScreen(props: {
  initialSourcePath?: string | undefined;
  onStartRun: (request: RunLaunchRequest) => void;
  loadSnapshot?: () => Promise<RunSetupSnapshot>;
}): React.JSX.Element {
  const [step, setStep] = useState<RunSetupStep>("source");
  const [sourcePath, setSourcePath] = useState(props.initialSourcePath ?? "");
  const [iterationsText, setIterationsText] = useState("1");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [refineIndex, setRefineIndex] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);
  const initializedRefineSelection = useRef(false);

  const snapshotState = useReloadableAsyncValue(
    async () => props.loadSnapshot?.() ?? collectRunSetupSnapshot(),
    []
  );

  const snapshot = snapshotState.value;
  const selectedReviewModel =
    snapshot?.reviewModels[reviewIndex] ?? snapshot?.reviewModels[0];
  const selectedRefineModel =
    snapshot?.refineModels[refineIndex] ?? snapshot?.refineModels[0];
  const confirmedReviewModels =
    step === "refine-model" || step === "launch"
      ? selectedReviewModel === undefined
        ? []
        : [selectedReviewModel]
      : [];
  const confirmedRefineModels =
    step === "launch"
      ? selectedRefineModel === undefined
        ? []
        : [selectedRefineModel]
      : [];

  const summaryState = useMemo(() => {
    if (snapshot === undefined) {
      return "action-required" as InteractiveReadinessState;
    }

    return snapshot.state;
  }, [snapshot]);

  useEffect(() => {
    if (snapshot === undefined) {
      initializedRefineSelection.current = false;
      return;
    }

    if (snapshot.refineModels.length === 0) {
      initializedRefineSelection.current = false;
      setRefineIndex(0);
      return;
    }

    if (!initializedRefineSelection.current) {
      const configuredDefaultModel = snapshot.config?.revision.defaults.model;
      const configuredIndex =
        configuredDefaultModel === undefined
          ? -1
          : snapshot.refineModels.findIndex(
              (model) => model === configuredDefaultModel
            );

      setRefineIndex(configuredIndex >= 0 ? configuredIndex : 0);
      initializedRefineSelection.current = true;
      return;
    }

    if (refineIndex >= snapshot.refineModels.length) {
      setRefineIndex(0);
    }
  }, [refineIndex, snapshot]);

  useInput((_input, key) => {
    if (snapshot === undefined || snapshotState.loading) {
      return;
    }

    if (step === "review-model") {
      if (key.upArrow && reviewIndex > 0) {
        setReviewIndex((current) => current - 1);
        return;
      }

      if (key.downArrow && reviewIndex < snapshot.reviewModels.length - 1) {
        setReviewIndex((current) => current + 1);
        return;
      }
    }

    if (step === "refine-model") {
      if (key.upArrow && refineIndex > 0) {
        setRefineIndex((current) => current - 1);
        return;
      }

      if (key.downArrow && refineIndex < snapshot.refineModels.length - 1) {
        setRefineIndex((current) => current + 1);
        return;
      }
    }

    if (!key.return) {
      return;
    }

    try {
      switch (step) {
        case "source":
          if (!isMarkdownFilePath(sourcePath)) {
            throw new Error("Run input must be a Markdown file.");
          }

          setError(undefined);
          setStep("iterations");
          return;
        case "iterations":
          parseIterations(iterationsText);
          setError(undefined);
          setStep("review-model");
          return;
        case "review-model":
          if (selectedReviewModel === undefined) {
            throw new Error("No review models are available.");
          }

          setError(undefined);
          setStep("refine-model");
          return;
        case "refine-model":
          if (selectedRefineModel === undefined) {
            throw new Error("No revision models are available.");
          }

          setError(undefined);
          setStep("launch");
          return;
        case "launch":
          if (summaryState === "stale" || summaryState === "action-required") {
            throw new Error("Resolve required readiness issues before starting the run.");
          }

          if (selectedReviewModel === undefined || selectedRefineModel === undefined) {
            throw new Error("Select both the review and revision models before starting.");
          }

          props.onStartRun({
            sourcePath,
            iterations: parseIterations(iterationsText),
            reviewModel: selectedReviewModel,
            refineModel: selectedRefineModel
          });
          return;
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Run setup failed.");
    }
  });

  if (snapshotState.loading) {
    return <Text>Loading run setup…</Text>;
  }

  if (snapshotState.error !== undefined) {
    return <Text color="red">{snapshotState.error}</Text>;
  }

  if (snapshot === undefined) {
    return <Text color="red">Run setup could not be loaded.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Section title="Launch Readiness">
        <StatusLine state={summaryState} text={renderReadinessText(snapshot)} />
        {snapshot.requiredIssues.map((issue) => (
          <Text key={issue}>{issue}</Text>
        ))}
        {snapshot.warnings.map((warning) => (
          <Text key={warning} color="yellow">
            {warning}
          </Text>
        ))}
      </Section>
      <Section title="Source Draft">
        {step === "source" ? (
          <TextInput value={sourcePath} onChange={setSourcePath} />
        ) : (
          <Text>{sourcePath}</Text>
        )}
      </Section>
      <Section title="Iterations">
        {step === "iterations" ? (
          <TextInput value={iterationsText} onChange={setIterationsText} />
        ) : (
          <Text>{iterationsText}</Text>
        )}
      </Section>
      <Section title="Review Model">
        {snapshot.reviewModels.length === 0 ? (
          <Text>No review models available.</Text>
        ) : (
          <MenuList
            items={snapshot.reviewModels.map((model) => ({
              id: model,
              label: model
            }))}
            selectedId={selectedReviewModel ?? snapshot.reviewModels[0] ?? "none"}
            confirmedIds={confirmedReviewModels}
          />
        )}
      </Section>
      <Section title="Revision Model">
        {snapshot.refineModels.length === 0 ? (
          <Text>No revision models available.</Text>
        ) : (
          <MenuList
            items={snapshot.refineModels.map((model) => ({
              id: model,
              label: model
            }))}
            selectedId={selectedRefineModel ?? snapshot.refineModels[0] ?? "none"}
            confirmedIds={confirmedRefineModels}
          />
        )}
      </Section>
      {step === "launch" ? (
        <Text color="green">Press Enter to start the draft iteration loop.</Text>
      ) : null}
      {error === undefined ? null : <Text color="red">{error}</Text>}
      <FooterHelp
        text={
          step === "source"
            ? "Type source path • Enter continue"
            : step === "iterations"
              ? "Type iterations (1-10) • Enter continue"
              : step === "review-model"
                ? "↑/↓ choose review model • Enter continue"
                : step === "refine-model"
                  ? "↑/↓ choose revision model • Enter continue"
                  : "Enter explicitly start the run"
        }
      />
    </Box>
  );
}

async function collectRunSetupSnapshot(): Promise<RunSetupSnapshot> {
  const paths = resolveUraniborgPaths();
  await ensureUraniborgAppHome(paths);
  const authClient = createRevisionAuthClient();
  const runner = createSerializedFeynmanCommandRunner(
    createNodeFeynmanCommandRunner()
  );
  const snapshot = await collectFeynmanRuntimeSnapshot({
    inspectRuntime: inspectFeynmanRuntime,
    listModels: listFeynmanModels,
    getAlphaStatus: getFeynmanAlphaStatus,
    getSearchStatus: getFeynmanSearchStatus,
    runner,
    includeReviewModels: true,
    includeCapabilities: true
  });
  const configResult = await loadUraniborgConfig(
    paths.configFile,
    undefined,
    undefined,
    authClient
  );

  const requiredIssues = snapshot.readinessReport.checks
    .filter((check) => check.tier === "required" && !check.ready)
    .map((check) => check.summary);
  const warnings = snapshot.readinessReport.checks
    .filter((check) => check.tier === "recommended" && !check.ready)
    .map((check) => check.summary);
  const states: InteractiveReadinessState[] = [];

  if (requiredIssues.length > 0) {
    states.push("action-required");
  }

  if (warnings.length > 0) {
    states.push("warning");
  }

  if (!configResult.ok) {
    states.push(
      configResult.error.code === "config_stale_revision_setup"
        ? "stale"
        : "action-required"
    );
    requiredIssues.push(configResult.error.message, ...(configResult.error.details ?? []));
  }

  return {
    state: resolveInteractiveReadinessState(states),
    requiredIssues,
    warnings,
    reviewModels: [...snapshot.readinessReport.reviewModels].sort((left, right) =>
      left.localeCompare(right)
    ),
    refineModels: configResult.ok
      ? [
          ...(authClient.listAvailableModelIds?.(
            configResult.value.revision.runtime.providerId
          ) ?? [])
        ].sort((left, right) => left.localeCompare(right))
      : [],
    ...(configResult.ok ? { config: configResult.value } : {})
  };
}

function parseIterations(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error("Iteration count must be an integer.");
  }

  if (parsed < MIN_ITERATIONS || parsed > MAX_ITERATIONS) {
    throw new Error(
      `Iteration count must be between ${MIN_ITERATIONS} and ${MAX_ITERATIONS}.`
    );
  }

  return parsed;
}

function renderReadinessText(snapshot: RunSetupSnapshot): string {
  switch (snapshot.state) {
    case "ready":
      return "Run setup is ready.";
    case "warning":
      return "Run setup can proceed, but recommended research capabilities are missing.";
    case "stale":
      return "Run setup is blocked by stale revision setup and must be refreshed.";
    case "action-required":
      return "Run setup is blocked by required readiness issues.";
  }
}
