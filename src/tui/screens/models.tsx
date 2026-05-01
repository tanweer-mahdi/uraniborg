import React from "react";
import { Box, Text } from "ink";

import {
  collectModelsReport,
  type ModelsReport,
  renderModelsReport
} from "../../cli/commands/models.js";
import { FooterHelp, Section } from "../components.js";
import { useReloadableAsyncValue } from "../hooks.js";

export function ModelsScreen(props: {
  loadReport?: () => Promise<ModelsReport>;
}): React.JSX.Element {
  const reportState = useReloadableAsyncValue(
    async () => props.loadReport?.() ?? collectModelsReport(),
    []
  );

  if (reportState.loading) {
    return <Text>Loading models…</Text>;
  }

  if (reportState.error !== undefined) {
    return <Text color="red">{reportState.error}</Text>;
  }

  if (reportState.value === undefined) {
    return <Text color="red">Models could not be loaded.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Section title="Model Availability">
        {renderModelsReport(reportState.value).map((line, index) => (
          <Text key={`${index}:${line}`}>{line}</Text>
        ))}
      </Section>
      <FooterHelp text="Esc back to dashboard" />
    </Box>
  );
}
