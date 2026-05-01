import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";

import {
  collectHistoryEntries,
  type HistoryEntry
} from "../../cli/commands/history.js";
import { FooterHelp, MenuList, Section } from "../components.js";
import { useReloadableAsyncValue } from "../hooks.js";

export function HistoryScreen(props: {
  onOpenRun: (runId: string) => void;
  loadEntries?: () => Promise<readonly HistoryEntry[]>;
}): React.JSX.Element {
  const [selection, setSelection] = useState(0);
  const historyState = useReloadableAsyncValue(
    async () => props.loadEntries?.() ?? collectHistoryEntries({}),
    []
  );

  const items = useMemo(
    () =>
      (historyState.value ?? []).map((entry) => ({
        id: entry.runId,
        label: `${entry.runId} | ${entry.status}`,
        hint: `${entry.createdAt} | ${entry.progress} | ${entry.title}`
      })),
    [historyState.value]
  );

  useInput((_input, key) => {
    if (key.upArrow && selection > 0) {
      setSelection((current) => current - 1);
      return;
    }

    if (key.downArrow && selection < items.length - 1) {
      setSelection((current) => current + 1);
      return;
    }

    if (key.return) {
      const selectedItem = items[selection];

      if (selectedItem !== undefined) {
        props.onOpenRun(selectedItem.id);
      }
    }
  });

  if (historyState.loading) {
    return <Text>Loading history…</Text>;
  }

  if (historyState.error !== undefined) {
    return <Text color="red">{historyState.error}</Text>;
  }

  if ((historyState.value ?? []).length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No Uraniborg runs are available.</Text>
        <FooterHelp text="Esc back to dashboard" />
      </Box>
    );
  }

  const selectedId = items[selection]?.id ?? items[0]?.id ?? "none";

  return (
    <Box flexDirection="column">
      <Section title="Run History">
        <MenuList items={items} selectedId={selectedId} />
      </Section>
      <FooterHelp text="↑/↓ choose run • Enter open detail" />
    </Box>
  );
}
