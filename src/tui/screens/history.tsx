import React, { useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";

import {
  collectHistoryEntries,
  type HistoryEntry
} from "../../cli/commands/history.js";
import { FooterHelp, Section } from "../components.js";
import { useReloadableAsyncValue } from "../hooks.js";
import { HistoryTable } from "../history-table.js";

export function HistoryScreen(props: {
  onOpenRun: (runId: string) => void;
  loadEntries?: () => Promise<readonly HistoryEntry[]>;
  terminalWidth?: number;
}): React.JSX.Element {
  const [selection, setSelection] = useState(0);
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

    if (key.return) {
      const selectedEntry = entries[selection];

      if (selectedEntry !== undefined) {
        props.onOpenRun(selectedEntry.runId);
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
      <FooterHelp text="↑/↓ choose run • Enter open detail" />
    </Box>
  );
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
