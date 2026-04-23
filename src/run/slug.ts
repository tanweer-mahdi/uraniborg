export function slugifyRunLabel(input: string): string {
  const normalizedInput = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedInput.length > 0 ? normalizedInput : "run";
}

export function createRunId(timestamp: Date, slug: string): string {
  const isoTimestamp = timestamp.toISOString().replace(/\.\d{3}Z$/, "Z");
  const safeTimestamp = isoTimestamp.replace(/:/g, "-");

  return `${safeTimestamp}-${slug}`;
}

export function deriveRunTitleFromSourcePath(sourcePath: string): string {
  const normalizedSourcePath = sourcePath.replace(/\\/g, "/");
  const basename = normalizedSourcePath.split("/").at(-1) ?? sourcePath;
  const withoutExtension = basename.replace(/\.[^.]+$/, "");
  const title = withoutExtension
    .replace(/[_-]+/g, " ")
    .trim();

  return title.length > 0 ? title : "Untitled Draft";
}
