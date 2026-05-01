import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";

import {
  collectDoctorReport,
  renderDoctorReport,
  type DoctorReport
} from "../../cli/commands/doctor.js";
import {
  createNodeFeynmanInteractiveLauncher
} from "../../review/feynman-remediation.js";
import {
  launchFeynmanRemediationAction,
  type FeynmanRemediationAction
} from "../../review/index.js";
import { FooterHelp, MenuList, Section } from "../components.js";
import { useExternalFlowController } from "../external-flow.js";
import { useReloadableAsyncValue } from "../hooks.js";

interface DoctorActionItem {
  id: string;
  label: string;
  action: FeynmanRemediationAction;
}

export function DoctorScreen(props: {
  loadReport?: () => Promise<DoctorReport>;
  launchAction?: (
    report: DoctorReport,
    action: FeynmanRemediationAction
  ) => Promise<
    | {
        kind: "success";
        message: string;
        refresh?: boolean | undefined;
      }
    | {
        kind: "failed";
        message: string;
      }
  >;
}): React.JSX.Element {
  const [selection, setSelection] = useState(0);
  const externalFlow = useExternalFlowController();
  const reportState = useReloadableAsyncValue(
    async () => props.loadReport?.() ?? collectDoctorReport(),
    []
  );

  const actionItems = useMemo(() => {
    if (reportState.value === undefined) {
      return [] as readonly DoctorActionItem[];
    }

    return buildDoctorActionItems(reportState.value);
  }, [reportState.value]);

  useInput((_input, key) => {
    if (externalFlow.busy) {
      return;
    }

    if (key.upArrow && selection > 0) {
      setSelection((current) => current - 1);
      return;
    }

    if (key.downArrow && selection < actionItems.length - 1) {
      setSelection((current) => current + 1);
      return;
    }

    if (key.return) {
      const selectedAction = actionItems[selection];
      const report = reportState.value;

      if (selectedAction === undefined || report === undefined) {
        return;
      }

      void externalFlow.runFlow({
        startingStatus: "Launching remediation…",
        async run() {
          return (
            (await props.launchAction?.(report, selectedAction.action)) ??
            launchSelectedAction(report, selectedAction.action)
          );
        },
        onRefresh: reportState.reload
      });
    }
  });

  if (reportState.loading) {
    return <Text>Loading doctor state…</Text>;
  }

  if (reportState.error !== undefined) {
    return <Text color="red">{reportState.error}</Text>;
  }

  const report = reportState.value;

  if (report === undefined) {
    return <Text color="red">Doctor state could not be loaded.</Text>;
  }

  const selectedId =
    actionItems[selection]?.id ?? actionItems[0]?.id ?? "none";

  return (
    <Box flexDirection="column">
      <Section title="Doctor Report">
        {renderDoctorReport(report).map((line, index) => (
          <Text key={`${index}:${line}`}>{line}</Text>
        ))}
      </Section>
      <Section title="Remediation Actions">
        {actionItems.length === 0 ? (
          <Text>No launchable remediation actions are currently available.</Text>
        ) : (
          <MenuList
            items={actionItems.map((item) => ({
              id: item.id,
              label: item.label
            }))}
            selectedId={selectedId}
          />
        )}
      </Section>
      {externalFlow.status === undefined ? null : (
        <Text color="yellow">{externalFlow.status}</Text>
      )}
      {externalFlow.error === undefined ? null : (
        <Text color="red">{externalFlow.error}</Text>
      )}
      <FooterHelp text="↑/↓ choose remediation • Enter launch remediation" />
    </Box>
  );
}

function buildDoctorActionItems(report: DoctorReport): readonly DoctorActionItem[] {
  return report.readinessReport.checks
    .flatMap((check: DoctorReport["readinessReport"]["checks"][number]) =>
      check.remediation === undefined ? [] : [check.remediation]
    )
    .map((action: FeynmanRemediationAction, index: number) => ({
      id: `${index}:${action.kind}:${action.provider ?? "default"}`,
      label: describeAction(action),
      action: normalizeDoctorAction(action)
    }));
}

function describeAction(action: FeynmanRemediationAction): string {
  switch (action.kind) {
    case "install_or_expose_runtime":
    case "setup":
      return action.reason;
    case "model_login":
      return `${action.reason}${action.provider === undefined ? "" : ` (${action.provider})`}`;
    case "alpha_login":
      return action.reason;
    case "search_configure":
      return `${action.reason}${action.provider === undefined ? " (auto)" : ` (${action.provider})`}`;
  }
}

function normalizeDoctorAction(
  action: FeynmanRemediationAction
): FeynmanRemediationAction {
  return action.kind === "search_configure" && action.provider === undefined
    ? {
        ...action,
        provider: "auto"
      }
    : action;
}

async function launchSelectedAction(
  report: DoctorReport,
  action: FeynmanRemediationAction
): Promise<
  | {
      kind: "success";
      message: string;
      refresh?: boolean | undefined;
    }
  | {
      kind: "failed";
      message: string;
    }
> {
  if (report.runtimeStatus.executablePath === undefined) {
    return {
      kind: "failed",
      message: "Feynman executable path is unavailable for remediation launch."
    };
  }

  const result = await launchFeynmanRemediationAction(
    report.runtimeStatus.executablePath,
    action,
    createNodeFeynmanInteractiveLauncher()
  );

  if (result.exitCode === 0) {
    return {
      kind: "success",
      message: "Remediation completed. Refreshing state…",
      refresh: true
    };
  }

  return {
    kind: "failed",
    message: `Remediation exited with code ${result.exitCode}.`
  };
}
