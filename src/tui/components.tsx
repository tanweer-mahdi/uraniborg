import React from "react";
import { Box, Text } from "ink";

export function ShellFrame(props: {
  title: string;
  subtitle?: string | undefined;
  masthead?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" padding={1}>
      {props.masthead === undefined ? null : (
        <Box flexDirection="column">{props.masthead}</Box>
      )}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          {props.title}
        </Text>
        {props.subtitle === undefined ? null : (
          <Text color="gray">{props.subtitle}</Text>
        )}
      </Box>
      <Box flexDirection="column">{props.children}</Box>
      {props.footer === undefined ? null : (
        <Box marginTop={1}>{props.footer}</Box>
      )}
    </Box>
  );
}

export function StatusLine(props: {
  state: "ready" | "action-required" | "stale" | "warning";
  text: string;
}): React.JSX.Element {
  const color =
    props.state === "ready"
      ? "green"
      : props.state === "warning"
        ? "yellow"
        : "red";

  return (
    <Text color={color}>
      [{props.state}] {props.text}
    </Text>
  );
}

export function Section(props: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>{props.title}</Text>
      <Box marginLeft={2} flexDirection="column">
        {props.children}
      </Box>
    </Box>
  );
}

export function MenuList<T extends string>(props: {
  items: readonly {
    id: T;
    label: string;
    hint?: string | undefined;
  }[];
  selectedId: T;
  confirmedIds?: readonly T[] | undefined;
}): React.JSX.Element {
  const confirmedIds = new Set(props.confirmedIds ?? []);

  return (
    <Box flexDirection="column">
      {props.items.map((item) => {
        const selected = item.id === props.selectedId;
        const confirmed = confirmedIds.has(item.id);
        const showHint =
          selected &&
          item.hint !== undefined &&
          item.hint.trim().length > 0;

        return (
          <Box key={item.id} flexDirection="column">
            <Text
              {...(selected
                ? {
                    color: "cyan" as const
                  }
                : {})}
            >
              {selected ? "› " : "  "}
              {confirmed ? "✓ " : ""}
              {item.label}
            </Text>
            {showHint ? (
              <Text color="#b8b8b8">
                {"  "}
                {item.hint}
              </Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

export function FooterHelp(props: {
  text: string;
}): React.JSX.Element {
  return <Text color="gray">{props.text}</Text>;
}
