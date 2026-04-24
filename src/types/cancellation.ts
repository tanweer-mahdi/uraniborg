export class OperationCancelledError extends Error {
  readonly code = "operation_cancelled";

  constructor(message: string) {
    super(message);
    this.name = "OperationCancelledError";
  }
}

export function createOperationCancelledError(
  message: string
): OperationCancelledError {
  return new OperationCancelledError(message);
}

export function isOperationCancelledError(error: unknown): boolean {
  if (error instanceof OperationCancelledError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "AbortError" ||
    error.name === "OperationCancelledError" ||
    error.message === "Uraniborg run cancelled." ||
    error.message === "Uraniborg resume cancelled." ||
    error.message.includes("cancelled")
  );
}
