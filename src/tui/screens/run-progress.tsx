import React from "react";
import { Box, Text } from "ink";

import type { RunFailureKind, RunLifecyclePhase } from "../../ui/interactive.js";
import { FooterHelp, Section } from "../components.js";

export interface RunProgressViewModel {
  runId: string;
  status:
    | "preparing"
    | "running"
    | "failed"
    | "completed";
  iteration?: number | undefined;
  totalIterations?: number | undefined;
  phase?: RunLifecyclePhase | undefined;
  message?: string | undefined;
  failureKind?: RunFailureKind | undefined;
  pointers?: readonly string[] | undefined;
  finalDraftFile?: string | undefined;
}

export function RunProgressScreen(props: {
  progress: RunProgressViewModel;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Section title="Run State">
        <Text>Run: {props.progress.runId}</Text>
        <Text>Status: {props.progress.status}</Text>
        {props.progress.iteration === undefined ||
        props.progress.totalIterations === undefined ? null : (
          <Text>
            Iteration: {props.progress.iteration}/{props.progress.totalIterations}
          </Text>
        )}
        {props.progress.phase === undefined ? null : (
          <Text>Phase: {props.progress.phase}</Text>
        )}
        {props.progress.message === undefined ? null : (
          <Text>{props.progress.message}</Text>
        )}
      </Section>
      {props.progress.failureKind === undefined ? null : (
        <Section title="Failure">
          <Text color="red">{props.progress.failureKind}</Text>
          {(props.progress.pointers ?? []).map((pointer) => (
            <Text key={pointer}>{pointer}</Text>
          ))}
        </Section>
      )}
      {props.progress.finalDraftFile === undefined ? null : (
        <Section title="Final Output">
          <Text>{props.progress.finalDraftFile}</Text>
        </Section>
      )}
      <FooterHelp text="Esc return to dashboard when you are done" />
    </Box>
  );
}
