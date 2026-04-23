export function createNotImplementedError(commandName: string): Error {
  return new Error(`Command "${commandName}" is not implemented yet.`);
}
