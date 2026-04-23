export function writeInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}
