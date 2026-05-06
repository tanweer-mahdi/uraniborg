import React, { useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";

import {
  collectHistoryEntries,
  type HistoryEntry
} from "../../cli/commands/history.js";
import {
  openRunSnapshot,
  type OpenRunSnapshotResult
} from "../../history-viewer/index.js";
import { FooterHelp, Section } from "../components.js";
import { useReloadableAsyncValue } from "../hooks.js";
import { HistoryTable } from "../history-table.js";

type SnapshotLaunchStatus =
  | {
      state: "idle";
    }
  | {
      state: "opening";
      runId: string;
    }
  | {
      state: "opened";
      snapshotFile: string;
      snapshotUrl: string;
    }
  | {
      state: "manual";
      message: string;
      snapshotFile: string;
      snapshotUrl: string;
    }
  | {
      state: "failed";
      message: string;
    };

export function HistoryScreen(props: {
  loadEntries?: () => Promise<readonly HistoryEntry[]>;
  openSnapshot?: (runId: string) => Promise<OpenRunSnapshotResult>;
  terminalWidth?: number;
}): React.JSX.Element {
  const [selection, setSelection] = useState(0);
  const [launchStatus, setLaunchStatus] = useState<SnapshotLaunchStatus>({
    state: "idle"
  });
  const detectedTerminalWidth = useTerminalWidth();
  const terminalWidth = props.terminalWidth ?? detectedTerminalWidth;
  const historyState = useReloadableAsyncValue(
    async () => props.loadEntries?.() ?? collectHistoryEntries({}),
    []
  );
  const entries = historyState.value ?? [];

  useEffect(() => {
    if (selection >= entries.length && entries.length > 0) {
      setSelection(entries.length - 1);
    }
  }, [entries.length, selection]);

  useInput((_input, key) => {
    if (key.upArrow && selection > 0) {
      setSelection((current) => current - 1);
      return;
    }

    if (key.downArrow && selection < entries.length - 1) {
      setSelection((current) => current + 1);
      return;
    }

    if (key.return && launchStatus.state !== "opening") {
      const selectedEntry = entries[selection];

      if (selectedEntry !== undefined) {
        void launchSnapshot(selectedEntry.runId);
      }
    }
  });

  if (historyState.loading) {
    return <Text>Loading history…</Text>;
  }

  if (historyState.error !== undefined) {
    return <Text color="red">{historyState.error}</Text>;
  }

  if (entries.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No Uraniborg runs are available.</Text>
        <FooterHelp text="Esc back to dashboard" />
      </Box>
    );
  }

  const selectedId = entries[selection]?.runId ?? entries[0]?.runId ?? "none";

  return (
    <Box flexDirection="column">
      <Section title="Run History">
        <HistoryTable
          entries={entries}
          selectedId={selectedId}
          terminalWidth={terminalWidth}
        />
      </Section>
      <SnapshotLaunchMessage status={launchStatus} />
      <FooterHelp text="↑/↓ choose run • Enter open browser snapshot" />
    </Box>
  );

  async function launchSnapshot(runId: string): Promise<void> {
    const launch = props.openSnapshot ?? openRunSnapshot;

    setLaunchStatus({
      state: "opening",
      runId
    });

    try {
      const result = await launch(runId);

      if (result.browser.opened) {
        setLaunchStatus({
          state: "opened",
          snapshotFile: result.snapshotFile,
          snapshotUrl: result.snapshotUrl
        });
        return;
      }

      setLaunchStatus({
        state: "manual",
        message: result.browser.message,
        snapshotFile: result.snapshotFile,
        snapshotUrl: result.snapshotUrl
      });
    } catch (error) {
      setLaunchStatus({
        state: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Snapshot generation failed with an unknown error."
      });
    }
  }
}

function SnapshotLaunchMessage(props: {
  status: SnapshotLaunchStatus;
}): React.JSX.Element | null {
  switch (props.status.state) {
    case "idle":
      return null;
    case "opening":
      return <Text>Generating snapshot for {props.status.runId}…</Text>;
    case "opened":
      return (
        <Box flexDirection="column">
          <Text color="green">Opened run snapshot in browser.</Text>
          <Text>{props.status.snapshotUrl}</Text>
        </Box>
      );
    case "manual":
      return (
        <Box flexDirection="column">
          <Text color="yellow">Snapshot generated. Open it manually:</Text>
          <Text>{props.status.snapshotUrl}</Text>
          <Text dimColor>{props.status.message}</Text>
        </Box>
      );
    case "failed":
      return <Text color="red">{props.status.message}</Text>;
  }
}

function useTerminalWidth(): number {
  const { stdout } = useStdout();
  const [width, setWidth] = useState<number>(stdout.columns ?? 80);

  useEffect(() => {
    const refreshWidth = (): void => {
      setWidth(stdout.columns ?? 80);
    };

    refreshWidth();
    stdout.on("resize", refreshWidth);

    return () => {
      stdout.off("resize", refreshWidth);
    };
  }, [stdout]);

  return width;
}
