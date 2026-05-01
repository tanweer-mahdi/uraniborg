export type TuiRoute =
  | {
      kind: "dashboard";
    }
  | {
      kind: "doctor";
    }
  | {
      kind: "models";
    }
  | {
      kind: "revision-config";
    }
  | {
      kind: "revision-setup";
    }
  | {
      kind: "history";
    }
  | {
      kind: "run-detail";
      runId: string;
      resumeRequested: boolean;
    }
  | {
      kind: "run-setup";
      sourcePath?: string | undefined;
    }
  | {
      kind: "run-progress";
      runId: string;
    };

export interface TuiLaunchIntent {
  route: TuiRoute;
}
