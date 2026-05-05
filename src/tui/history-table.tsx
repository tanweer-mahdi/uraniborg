import React from "react";
import { Box, Text } from "ink";

import type { HistoryEntry } from "../cli/commands/history.js";

const WIDE_LAYOUT_MIN_WIDTH = 86;
const SELECTED_MARKER = ">";
const UNSELECTED_MARKER = " ";
const COLUMN_GAP = "  ";

type WideColumn = {
  key: keyof HistoryEntry;
  header: string;
  width: number;
};

const FIXED_WIDE_COLUMNS = [
  { key: "status", header: "Status", width: 16 },
  { key: "progress", header: "Prog", width: 6 },
  { key: "createdAt", header: "Created", width: 20 }
] as const satisfies readonly WideColumn[];

const RUN_ID_COLUMN = {
  key: "runId",
  header: "Run ID",
  width: 18
} as const satisfies WideColumn;

export function HistoryTable(props: {
  entries: readonly HistoryEntry[];
  selectedId: string;
  terminalWidth: number;
}): React.JSX.Element {
  if (usesWideHistoryLayout(props.terminalWidth)) {
    return (
      <Box flexDirection="column">
        <Text dimColor>{formatWideHistoryHeader(props.terminalWidth)}</Text>
        {props.entries.map((entry) => (
          <Text
            key={entry.runId}
            {...(entry.runId === props.selectedId ? { color: "cyan" } : {})}
          >
            {formatWideHistoryRow({
              entry,
              selected: entry.runId === props.selectedId,
              terminalWidth: props.terminalWidth
            })}
          </Text>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {props.entries.map((entry) => (
        <Box key={entry.runId} flexDirection="column" marginBottom={1}>
          {formatCompactHistoryRow({
            entry,
            selected: entry.runId === props.selectedId,
            terminalWidth: props.terminalWidth
          }).map((line, index) => (
            <Text
              key={`${entry.runId}-${index}`}
              {...(entry.runId === props.selectedId ? { color: "cyan" } : {})}
            >
              {line}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function usesWideHistoryLayout(terminalWidth: number): boolean {
  return terminalWidth >= WIDE_LAYOUT_MIN_WIDTH;
}

export function formatWideHistoryHeader(terminalWidth: number): string {
  return formatWideCells({
    marker: " ",
    cells: buildWideColumns(terminalWidth).map((column) => ({
      value: column.header,
      width: column.width
    }))
  });
}

export function formatWideHistoryRow(input: {
  entry: HistoryEntry;
  selected: boolean;
  terminalWidth: number;
}): string {
  return formatWideCells({
    marker: input.selected ? SELECTED_MARKER : UNSELECTED_MARKER,
    cells: buildWideColumns(input.terminalWidth).map((column) => ({
      value: input.entry[column.key],
      width: column.width
    }))
  });
}

export function formatCompactHistoryRow(input: {
  entry: HistoryEntry;
  selected: boolean;
  terminalWidth: number;
}): readonly string[] {
  const contentWidth = Math.max(24, input.terminalWidth - 2);
  const prefix = input.selected ? `${SELECTED_MARKER} ` : `${UNSELECTED_MARKER} `;
  const lineWidth = Math.max(16, contentWidth - prefix.length);
  const statusLine = `${input.entry.status} ${input.entry.progress}`;
  const metadataLine = `${input.entry.createdAt} ${input.entry.runId}`;

  return [
    `${prefix}${truncate(input.entry.title, lineWidth)}`,
    `${UNSELECTED_MARKER.repeat(prefix.length)}${truncate(statusLine, lineWidth)}`,
    `${UNSELECTED_MARKER.repeat(prefix.length)}${truncate(metadataLine, lineWidth)}`
  ];
}

function buildWideColumns(terminalWidth: number): readonly WideColumn[] {
  const fixedColumnsWidth =
    FIXED_WIDE_COLUMNS.reduce((total, column) => total + column.width, 0) +
    RUN_ID_COLUMN.width;
  const markerWidth = 2;
  const gapWidth = COLUMN_GAP.length * FIXED_WIDE_COLUMNS.length;
  const titleWidth = Math.max(
    18,
    terminalWidth - markerWidth - fixedColumnsWidth - gapWidth
  );

  return [
    ...FIXED_WIDE_COLUMNS,
    { key: "title", header: "Title", width: titleWidth },
    RUN_ID_COLUMN
  ];
}

function formatWideCells(input: {
  marker: string;
  cells: readonly { value: string; width: number }[];
}): string {
  return `${input.marker} ${input.cells
    .map((cell) => padRight(truncate(cell.value, cell.width), cell.width))
    .join(COLUMN_GAP)}`.trimEnd();
}

function truncate(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }

  if (width <= 3) {
    return value.slice(0, width);
  }

  return `${value.slice(0, width - 3)}...`;
}

function padRight(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }

  return `${value}${" ".repeat(width - value.length)}`;
}
