import React, { useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";

import { runResumeCommand } from "../cli/commands/resume.js";
import { runRunCommand } from "../cli/commands/run.js";
import { FooterHelp, MenuList, ShellFrame } from "./components.js";
import { DoctorScreen } from "./screens/doctor.js";
import { HistoryScreen } from "./screens/history.js";
import { ModelsScreen } from "./screens/models.js";
import { RevisionConfigScreen } from "./screens/revision-config.js";
import { RevisionSetupScreen } from "./screens/revision-setup.js";
import { RunDetailScreen } from "./screens/run-detail.js";
import { RunProgressScreen, type RunProgressViewModel } from "./screens/run-progress.js";
import { RunSetupScreen, type RunLaunchRequest } from "./screens/run-setup.js";
import { nextProgressState } from "./progress-state.js";
import type { TuiLaunchIntent, TuiRoute } from "./types.js";

const DASHBOARD_ITEMS = [
  { id: "doctor", label: "Doctor", hint: "Check environment readiness" },
  { id: "models", label: "Models", hint: "Inspect review and revision model availability" },
  { id: "revision-config", label: "Config", hint: "Configure Feynman and revision providers" },
  { id: "run-setup", label: "Run", hint: "Start a draft review-revision loop" },
  { id: "history", label: "History", hint: "Inspect prior runs" }
] as const;

type DashboardItemId = (typeof DASHBOARD_ITEMS)[number]["id"];

export function UraniborgTuiApp(props: {
  initialIntent: TuiLaunchIntent;
}): React.JSX.Element {
  const { exit } = useApp();
  const [route, setRoute] = useState<TuiRoute>(props.initialIntent.route);
  const [dashboardSelection, setDashboardSelection] =
    useState<DashboardItemId>("doctor");
  const [progress, setProgress] = useState<RunProgressViewModel>({
    runId: "(pending)",
    status: "preparing",
    message: "Waiting to start a run."
  });

  useInput((input, key) => {
    if (key.escape) {
      if (route.kind === "dashboard") {
        exit();
        return;
      }

      if (route.kind === "run-progress" && progress.status === "running") {
        return;
      }

      setRoute({
        kind: "dashboard"
      });
      return;
    }

    if (route.kind !== "dashboard") {
      return;
    }

    const currentIndex = DASHBOARD_ITEMS.findIndex(
      (item) => item.id === dashboardSelection
    );

    if (key.upArrow && currentIndex > 0) {
      const nextItem = DASHBOARD_ITEMS[currentIndex - 1];

      if (nextItem !== undefined) {
        setDashboardSelection(nextItem.id);
      }

      return;
    }

    if (key.downArrow && currentIndex < DASHBOARD_ITEMS.length - 1) {
      const nextItem = DASHBOARD_ITEMS[currentIndex + 1];

      if (nextItem !== undefined) {
        setDashboardSelection(nextItem.id);
      }

      return;
    }

    if (key.return) {
      setRoute(mapDashboardSelectionToRoute(dashboardSelection));
    }
  });

  const routeView = useMemo(() => {
    switch (route.kind) {
      case "dashboard":
        return (
          <MenuList items={DASHBOARD_ITEMS} selectedId={dashboardSelection} />
        );
      case "doctor":
        return <DoctorScreen />;
      case "models":
        return <ModelsScreen />;
      case "revision-config":
        return (
          <RevisionConfigScreen
            onRevisionSetupRequested={() => {
              setRoute({ kind: "revision-setup" });
            }}
          />
        );
      case "revision-setup":
        return <RevisionSetupScreen />;
      case "history":
        return (
          <HistoryScreen
            onOpenRun={(runId) => {
              setRoute({
                kind: "run-detail",
                runId,
                resumeRequested: false
              });
            }}
          />
        );
      case "run-detail":
        return (
          <RunDetailScreen
            runId={route.runId}
            resumeRequested={route.resumeRequested}
            onResumeRequested={(runId) => {
              void startResume(runId, setProgress, setRoute);
            }}
          />
        );
      case "run-setup":
        return (
          <RunSetupScreen
            initialSourcePath={route.sourcePath}
            onStartRun={(request) => {
              void startRun(request, setProgress, setRoute);
            }}
          />
        );
      case "run-progress":
        return <RunProgressScreen progress={progress} />;
    }
  }, [dashboardSelection, progress, route]);

  return (
    <ShellFrame
      title={renderRouteTitle(route)}
      footer={
        route.kind === "dashboard" ? (
          <FooterHelp text="↑/↓ move • Enter open • Esc quit" />
        ) : route.kind === "run-progress" && progress.status === "running" ? (
          <FooterHelp text="Run is active • Esc disabled until terminal state changes" />
        ) : (
          <FooterHelp text="Esc back to dashboard" />
        )
      }
    >
      <Box flexDirection="column">
        {routeView}
      </Box>
    </ShellFrame>
  );
}

function mapDashboardSelectionToRoute(selection: DashboardItemId): TuiRoute {
  switch (selection) {
    case "revision-config":
      return { kind: "revision-config" };
    case "doctor":
      return { kind: "doctor" };
    case "models":
      return { kind: "models" };
    case "run-setup":
      return { kind: "run-setup" };
    case "history":
      return { kind: "history" };
  }
}

function renderRouteTitle(route: TuiRoute): string {
  switch (route.kind) {
    case "doctor":
      return "Doctor";
    case "models":
      return "Models";
    case "revision-config":
      return "Config";
    case "revision-setup":
      return "Revision Setup";
    case "history":
      return "History";
    case "run-detail":
      return `Run Detail: ${route.runId}`;
    case "run-setup":
      return "Run";
    case "run-progress":
      return `Run Progress: ${progressTitle(route.runId)}`;
    case "dashboard":
      return "Uraniborg";
  }
}

function progressTitle(runId: string): string {
  return runId;
}

async function startRun(
  request: RunLaunchRequest,
  setProgress: React.Dispatch<React.SetStateAction<RunProgressViewModel>>,
  setRoute: React.Dispatch<React.SetStateAction<TuiRoute>>
): Promise<void> {
  setProgress({
    runId: "(pending)",
    status: "preparing",
    message: "Preparing interactive run launch…"
  });
  setRoute({
    kind: "run-progress",
    runId: "(pending)"
  });

  try {
    await runRunCommand(
      request.sourcePath,
      {
        iterations: String(request.iterations),
        reviewModel: request.reviewModel,
        refineModel: request.refineModel,
        nonInteractive: true
      },
      {
        interactive: false,
        writeLine: () => {},
        eventSink: {
          onEvent: (event) => {
            setProgress((current) => nextProgressState(current, event));
            if (event.type === "run-started" || event.type === "run-resumed") {
              setRoute({
                kind: "run-progress",
                runId: event.runId
              });
            }
          }
        }
      }
    );
  } catch (error) {
    setProgress((current) => ({
      ...current,
      status: "failed",
      message:
        error instanceof Error ? error.message : "Interactive run execution failed."
    }));
  }
}

async function startResume(
  runId: string,
  setProgress: React.Dispatch<React.SetStateAction<RunProgressViewModel>>,
  setRoute: React.Dispatch<React.SetStateAction<TuiRoute>>
): Promise<void> {
  setProgress({
    runId,
    status: "preparing",
    message: `Preparing resume for ${runId}…`
  });
  setRoute({
    kind: "run-progress",
    runId
  });

  try {
    await runResumeCommand(
      runId,
      {
        nonInteractive: true
      },
      {
        interactive: false,
        writeLine: () => {},
        eventSink: {
          onEvent: (event) => {
            setProgress((current) => nextProgressState(current, event));
            if (event.type === "run-started" || event.type === "run-resumed") {
              setRoute({
                kind: "run-progress",
                runId: event.runId
              });
            }
          }
        }
      }
    );
  } catch (error) {
    setProgress((current) => ({
      ...current,
      status: "failed",
      message:
        error instanceof Error ? error.message : "Interactive resume execution failed."
    }));
  }
}
