import React from "react";
import { Box, Text, useInput } from "ink";

import { resolveUraniborgPaths } from "../../config/index.js";
import { resolveIterationArtifactPaths, resolveRunArtifactPaths } from "../../run/artifact-store.js";
import { readRunManifest } from "../../run/index.js";
import { FooterHelp, Section } from "../components.js";
import { useReloadableAsyncValue } from "../hooks.js";

export interface RunDetailViewModel {
  runId: string;
  title: string;
  status: string;
  createdAt: string;
  sourceInputPath: string;
  selectedModels: {
    review: string;
    refine: string;
  };
  iterationsPlanned: number;
  iterationsCompleted: number;
  currentIteration: number;
  lastError?: string | undefined;
  resumable: boolean;
  topLevelArtifacts: readonly string[];
  iterationArtifacts: readonly {
    iteration: number;
    files: readonly string[];
  }[];
}

export function RunDetailScreen(props: {
  runId: string;
  resumeRequested: boolean;
  onResumeRequested: (runId: string) => void;
  loadDetail?: (runId: string) => Promise<RunDetailViewModel>;
}): React.JSX.Element {
  const detailState = useReloadableAsyncValue(
    async () => props.loadDetail?.(props.runId) ?? collectRunDetail(props.runId),
    [props.runId]
  );

  useInput((_input, key) => {
    if (key.return && detailState.value?.resumable === true) {
      props.onResumeRequested(props.runId);
    }
  });

  if (detailState.loading) {
    return <Text>Loading run detail…</Text>;
  }

  if (detailState.error !== undefined) {
    return <Text color="red">{detailState.error}</Text>;
  }

  const detail = detailState.value;

  if (detail === undefined) {
    return <Text color="red">Run detail could not be loaded.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Section title="Summary">
        <Text>{detail.title}</Text>
        <Text>Run: {detail.runId}</Text>
        <Text>Status: {detail.status}</Text>
        <Text>Created: {detail.createdAt}</Text>
        <Text>Source: {detail.sourceInputPath}</Text>
        <Text>Review model: {detail.selectedModels.review}</Text>
        <Text>Revision model: {detail.selectedModels.refine}</Text>
        <Text>
          Iterations: {detail.iterationsCompleted}/{detail.iterationsPlanned}
        </Text>
        <Text>Current iteration: {detail.currentIteration}</Text>
        <Text>
          Resumable: {detail.resumable ? "yes" : "no"}
          {props.resumeRequested ? " (opened from resume intent)" : ""}
        </Text>
        {detail.lastError === undefined ? null : (
          <Text color="red">Last error: {detail.lastError}</Text>
        )}
      </Section>
      <Section title="Top-level Artifacts">
        {detail.topLevelArtifacts.map((artifact) => (
          <Text key={artifact}>{artifact}</Text>
        ))}
      </Section>
      <Section title="Per-iteration Artifacts">
        {detail.iterationArtifacts.map((group) => (
          <Box key={group.iteration} flexDirection="column" marginBottom={1}>
            <Text bold>Iteration {group.iteration}</Text>
            {group.files.map((filePath) => (
              <Text key={filePath}>{filePath}</Text>
            ))}
          </Box>
        ))}
      </Section>
      <FooterHelp text="Enter resume when available" />
    </Box>
  );
}

export async function collectRunDetail(runId: string): Promise<RunDetailViewModel> {
  const paths = resolveUraniborgPaths();
  const topLevel = resolveRunArtifactPaths(paths.runsDirectory, runId);
  const manifest = await readRunManifest(topLevel.manifestFile);
  const iterationArtifacts = Array.from(
    { length: manifest.iterationsPlanned },
    (_, index) => {
      const artifactPaths = resolveIterationArtifactPaths(
        topLevel.runDirectory,
        index + 1
      );

      return {
        iteration: index + 1,
        files: [
          artifactPaths.inputFile,
          artifactPaths.reviewFile,
          artifactPaths.reviewLogFile,
          artifactPaths.refinedDraftFile,
          artifactPaths.changesFile,
          artifactPaths.refineLogFile,
          artifactPaths.refineResponseFile
        ]
      };
    }
  );

  return {
    runId: manifest.runId,
    title: manifest.title,
    status: manifest.status,
    createdAt: manifest.createdAt,
    sourceInputPath: manifest.sourceInputPath,
    selectedModels: manifest.selectedModels,
    iterationsPlanned: manifest.iterationsPlanned,
    iterationsCompleted: manifest.iterationsCompleted,
    currentIteration: manifest.phaseMetadata.currentIteration,
    lastError: manifest.lastError?.message,
    resumable: manifest.status !== "finished",
    topLevelArtifacts: [
      topLevel.manifestFile,
      topLevel.configSnapshotFile,
      topLevel.originalDraftFile,
      topLevel.currentDraftFile,
      topLevel.informationHighwayFile,
      topLevel.finalDraftFile
    ],
    iterationArtifacts
  };
}
