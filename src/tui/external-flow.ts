import { useRef, useState } from "react";

export interface ExternalFlowPromptState {
  message: string;
}

export interface ExternalFlowController {
  busy: boolean;
  status: string | undefined;
  error: string | undefined;
  pendingPrompt: ExternalFlowPromptState | null;
  pendingPromptValue: string;
  setPendingPromptValue: (value: string) => void;
  submitPrompt: () => void;
  clearError: () => void;
  runFlow: (options: {
    startingStatus: string;
    run: (helpers: {
      appendStatus: (line: string) => void;
      replaceStatus: (line: string) => void;
      requestPrompt: (message: string) => Promise<string>;
    }) => Promise<
      | {
          kind: "success";
          message?: string | undefined;
          refresh?: boolean | undefined;
        }
      | {
          kind: "cancelled";
          message: string;
        }
      | {
          kind: "failed";
          message: string;
        }
    >;
    onRefresh?: () => void;
  }) => Promise<void>;
}

export function useExternalFlowController(): ExternalFlowController {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendingPrompt, setPendingPrompt] = useState<ExternalFlowPromptState | null>(null);
  const [pendingPromptValue, setPendingPromptValue] = useState("");
  const promptResolverRef = useRef<((value: string) => void) | null>(null);

  return {
    busy,
    status,
    error,
    pendingPrompt,
    pendingPromptValue,
    setPendingPromptValue,
    submitPrompt() {
      const resolver = promptResolverRef.current;

      if (resolver === null) {
        return;
      }

      promptResolverRef.current = null;
      setPendingPrompt(null);
      resolver(pendingPromptValue.trim());
    },
    clearError() {
      setError(undefined);
    },
    async runFlow(options) {
      setBusy(true);
      setError(undefined);
      setStatus(options.startingStatus);

      try {
        const result = await options.run({
          appendStatus(line) {
            setStatus((current) =>
              current === undefined ? line : `${current}\n${line}`
            );
          },
          replaceStatus(line) {
            setStatus(line);
          },
          requestPrompt(message) {
            return new Promise<string>((resolve) => {
              setPendingPromptValue("");
              setPendingPrompt({ message });
              promptResolverRef.current = resolve;
            });
          }
        });

        if (result.kind === "success") {
          if (result.message !== undefined) {
            setStatus(result.message);
          }

          if (result.refresh === true) {
            options.onRefresh?.();
          }

          return;
        }

        if (result.kind === "cancelled") {
          setStatus(result.message);
          return;
        }

        setError(result.message);
      } finally {
        promptResolverRef.current = null;
        setPendingPrompt(null);
        setBusy(false);
      }
    }
  };
}

export function isExternalFlowCancelled(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("cancelled")
  );
}
