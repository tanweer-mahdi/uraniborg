import React, { useEffect, useState } from "react";
import { Box, Text, useStdout } from "ink";

const ANSI_LOGO_LINES = [
  "                                          \u001b[38;2;153;255;153m█\u001b[0m\u001b[38;2;153;255;153m█\u001b[0m \u001b[38;2;153;255;153m█\u001b[0m\u001b[38;2;153;255;153m█\u001b[0m                                       ",
  "                                             \u001b[38;2;157;231;157m█\u001b[0m\u001b[38;2;157;231;157m█\u001b[0m                                       ",
  "\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m      \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m \u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m\u001b[38;2;161;207;161m█\u001b[0m",
  "\u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m      \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m               \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m      \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m      \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m      \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m       \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m      \u001b[38;2;166;183;166m█\u001b[0m\u001b[38;2;166;183;166m█\u001b[0m",
  "\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m      \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m       \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m      \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m      \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m      \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m       \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m      \u001b[38;2;170;159;170m█\u001b[0m\u001b[38;2;170;159;170m█\u001b[0m",
  "\u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m      \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m       \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m      \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m      \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m      \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m      \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m       \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m      \u001b[38;2;174;135;174m█\u001b[0m\u001b[38;2;174;135;174m█\u001b[0m",
  "\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m       \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m      \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m       \u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m\u001b[38;2;179;111;179m█\u001b[0m",
  "                                                                                    \u001b[38;2;183;87;183m█\u001b[0m\u001b[38;2;183;87;183m█\u001b[0m",
  "                                                                            \u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m\u001b[38;2;188;63;188m█\u001b[0m"
] as const;

const COMPACT_WORDMARK = "URANIBORG";
const COMPACT_BLOCK = "██";
const COMPACT_PALETTE = ["#99ff99", "#a1cfa1", "#ae87ae", "#bc3fbc"] as const;

type AnsiSegment = {
  text: string;
  color?: string;
};

const FULL_LOGO_SEGMENTS = ANSI_LOGO_LINES.map(parseAnsiSegments);
const FULL_LOGO_VISIBLE_WIDTH = Math.max(
  ...FULL_LOGO_SEGMENTS.map(measureVisibleWidth)
);

export function UraniborgLogo(): React.JSX.Element {
  const width = useTerminalWidth();

  if (width >= FULL_LOGO_VISIBLE_WIDTH + 4) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        {FULL_LOGO_SEGMENTS.map((segments, index) => (
          <Box key={index} width="100%" justifyContent="center">
            {segments.map((segment, segmentIndex) => (
              <Text
                key={`${index}-${segmentIndex}`}
                {...(segment.color === undefined ? {} : { color: segment.color })}
              >
                {segment.text}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  if (width >= 32) {
    return (
      <Box flexDirection="column" marginBottom={1} alignItems="center">
        <Text color={COMPACT_PALETTE[0]}>{COMPACT_BLOCK}</Text>
        <Text bold color={COMPACT_PALETTE[2]}>
          {COMPACT_WORDMARK}
        </Text>
        <Text color={COMPACT_PALETTE[3]}>{COMPACT_BLOCK.repeat(5)}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1} alignItems="center">
      <Text color={COMPACT_PALETTE[0]}>{COMPACT_BLOCK}</Text>
      <Text bold color={COMPACT_PALETTE[3]}>
        U
      </Text>
    </Box>
  );
}

function parseAnsiSegments(line: string): readonly AnsiSegment[] {
  const pattern = /\u001b\[(?:38;2;(\d+);(\d+);(\d+)|0)m/g;
  const segments: AnsiSegment[] = [];
  let currentColor: string | undefined;
  let cursor = 0;

  for (const match of line.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > cursor) {
      segments.push(
        buildAnsiSegment(line.slice(cursor, matchIndex), currentColor)
      );
    }

    if (match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      currentColor = `rgb(${match[1]},${match[2]},${match[3]})`;
    } else {
      currentColor = undefined;
    }

    cursor = matchIndex + match[0].length;
  }

  if (cursor < line.length) {
    segments.push(buildAnsiSegment(line.slice(cursor), currentColor));
  }

  return segments.filter((segment) => segment.text.length > 0);
}

function measureVisibleWidth(segments: readonly AnsiSegment[]): number {
  return segments.reduce((total, segment) => total + segment.text.length, 0);
}

function buildAnsiSegment(text: string, color: string | undefined): AnsiSegment {
  return color === undefined ? { text } : { text, color };
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
