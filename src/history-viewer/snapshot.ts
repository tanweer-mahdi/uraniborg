import { mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

import {
  createNodeRevisionBrowserLauncher,
  resolveUraniborgPaths,
  type RevisionBrowserLauncher
} from "../config/index.js";
import {
  resolveIterationArtifactPaths,
  resolveRunArtifactPaths
} from "../run/artifact-store.js";
import { readRunManifest, type RunManifest } from "../run/index.js";
import type { UraniborgPaths } from "../types/app-home.js";

const SNAPSHOT_DIRECTORY_NAME = "viewer-snapshots";
const PREVIEW_LIMIT_BYTES = 256 * 1024;
const SANITIZE_MARKDOWN_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "blockquote",
    "br",
    "code",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul"
  ],
  allowedAttributes: {
    a: ["href", "title"]
  },
  allowedSchemes: ["http", "https", "mailto"]
};
const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false
});

export interface HistoryViewerFilesystem {
  mkdir: (directoryPath: string) => Promise<void>;
  readFile: (filePath: string) => Promise<Buffer>;
  readdir: (
    directoryPath: string,
    options?: { withFileTypes?: false }
  ) => Promise<readonly string[]>;
  realpath: (entryPath: string) => Promise<string>;
  stat: (entryPath: string) => Promise<{ isFile: () => boolean }>;
  writeFile: (filePath: string, contents: string) => Promise<void>;
}

export interface HistoryViewerDependencies {
  browserLauncher?: RevisionBrowserLauncher;
  filesystem?: HistoryViewerFilesystem;
  now?: () => Date;
  resolvePaths?: typeof resolveUraniborgPaths;
}

export type BrowserOpenStatus =
  | {
      opened: true;
    }
  | {
      opened: false;
      message: string;
    };

export interface GenerateRunSnapshotResult {
  runId: string;
  snapshotFile: string;
  snapshotUrl: string;
}

export interface OpenRunSnapshotResult extends GenerateRunSnapshotResult {
  browser: BrowserOpenStatus;
}

interface ArtifactPreview {
  kind: "html" | "text" | "unavailable";
  content: string;
  truncated: boolean;
}

interface ReaderSection {
  id: string;
  label: string;
  groupLabel?: string | undefined;
  preview: ArtifactPreview;
}

interface IterationArtifactGroup {
  iteration: number;
  review?: ReaderSection | undefined;
  refined?: ReaderSection | undefined;
}

interface SelectedRunSnapshotView {
  generatedAt: string;
  manifest: RunManifest;
  original?: ReaderSection | undefined;
  iterationArtifacts: readonly IterationArtifactGroup[];
  finalRefined?: ReaderSection | undefined;
}

export async function openRunSnapshot(
  runId: string,
  dependencies: HistoryViewerDependencies = {}
): Promise<OpenRunSnapshotResult> {
  const snapshot = await generateRunSnapshot(runId, dependencies);
  const browserLauncher =
    dependencies.browserLauncher ?? createNodeRevisionBrowserLauncher();

  try {
    await browserLauncher.open(snapshot.snapshotUrl);
    return {
      ...snapshot,
      browser: {
        opened: true
      }
    };
  } catch (error) {
    return {
      ...snapshot,
      browser: {
        opened: false,
        message:
          error instanceof Error
            ? error.message
            : "Browser launcher failed with an unknown error."
      }
    };
  }
}

export async function generateRunSnapshot(
  runId: string,
  dependencies: HistoryViewerDependencies = {}
): Promise<GenerateRunSnapshotResult> {
  validateRunId(runId);

  const paths = (dependencies.resolvePaths ?? resolveUraniborgPaths)();
  const filesystem = dependencies.filesystem ?? createNodeHistoryViewerFilesystem();
  const runRoot = await resolveSelectedRunRoot(runId, paths, filesystem);
  const artifactPaths = resolveRunArtifactPaths(paths.runsDirectory, runId);
  const manifest = await readRunManifest(artifactPaths.manifestFile);
  const view = await buildSelectedRunSnapshotView({
    filesystem,
    generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    manifest,
    runRoot
  });
  const snapshotHtml = renderSnapshotHtml(view);
  const snapshotFile = await writeSnapshotFile({
    filesystem,
    html: snapshotHtml,
    paths,
    runId,
    timestamp: view.generatedAt
  });

  return {
    runId,
    snapshotFile,
    snapshotUrl: pathToFileURL(snapshotFile).href
  };
}

function createNodeHistoryViewerFilesystem(): HistoryViewerFilesystem {
  return {
    async mkdir(directoryPath: string): Promise<void> {
      await mkdir(directoryPath, { recursive: true });
    },
    async readFile(filePath: string): Promise<Buffer> {
      return readFile(filePath);
    },
    async readdir(directoryPath: string): Promise<readonly string[]> {
      return readdir(directoryPath);
    },
    realpath,
    async stat(entryPath: string): Promise<{ isFile: () => boolean }> {
      return stat(entryPath);
    },
    async writeFile(filePath: string, contents: string): Promise<void> {
      await writeFile(filePath, contents, "utf8");
    }
  };
}

async function resolveSelectedRunRoot(
  runId: string,
  paths: UraniborgPaths,
  filesystem: HistoryViewerFilesystem
): Promise<string> {
  const runsRoot = await filesystem.realpath(paths.runsDirectory).catch(() => {
    throw new Error(`Run "${runId}" was not found.`);
  });
  const candidateRunRoot = path.join(paths.runsDirectory, runId);
  const runRoot = await filesystem.realpath(candidateRunRoot).catch(() => {
    throw new Error(`Run "${runId}" was not found.`);
  });

  if (!isPathInside(runsRoot, runRoot)) {
    throw new Error(`Run "${runId}" was not found.`);
  }

  return runRoot;
}

async function buildSelectedRunSnapshotView(input: {
  filesystem: HistoryViewerFilesystem;
  generatedAt: string;
  manifest: RunManifest;
  runRoot: string;
}): Promise<SelectedRunSnapshotView> {
  return {
    generatedAt: input.generatedAt,
    manifest: input.manifest,
    original: await buildReaderSection({
      filePath: path.join(input.runRoot, "original.md"),
      filesystem: input.filesystem,
      id: "original",
      label: "Original",
      runRoot: input.runRoot
    }),
    iterationArtifacts: await collectIterationArtifacts(input),
    finalRefined: await buildReaderSection({
      filePath: path.join(input.runRoot, "final.md"),
      filesystem: input.filesystem,
      id: "final-refined",
      label: "Refined",
      runRoot: input.runRoot
    })
  };
}

async function collectIterationArtifacts(input: {
  filesystem: HistoryViewerFilesystem;
  manifest: RunManifest;
  runRoot: string;
}): Promise<readonly IterationArtifactGroup[]> {
  const groups: IterationArtifactGroup[] = [];

  for (
    let iteration = 1;
    iteration <= input.manifest.iterationsPlanned;
    iteration += 1
  ) {
    const paths = resolveIterationArtifactPaths(input.runRoot, iteration);
    const review = await buildReaderSection({
      filePath: path.join(paths.iterationDirectory, "review.md"),
      filesystem: input.filesystem,
      groupLabel: `Iteration ${iteration}`,
      id: `iteration-${iteration}-review`,
      label: "Review",
      runRoot: input.runRoot
    });
    const refined = await buildReaderSection({
      filePath: path.join(paths.iterationDirectory, "refined.md"),
      filesystem: input.filesystem,
      groupLabel: `Iteration ${iteration}`,
      id: `iteration-${iteration}-refined`,
      label: "Refined",
      runRoot: input.runRoot
    });

    if (review !== undefined || refined !== undefined) {
      groups.push({
        iteration,
        ...(review === undefined ? {} : { review }),
        ...(refined === undefined ? {} : { refined })
      });
    }
  }

  return groups;
}

async function buildReaderSection(input: {
  filePath: string;
  filesystem: HistoryViewerFilesystem;
  groupLabel?: string | undefined;
  id: string;
  label: string;
  runRoot: string;
}): Promise<ReaderSection | undefined> {
  const entryStat = await input.filesystem.stat(input.filePath).catch(() => undefined);

  if (entryStat === undefined) {
    return undefined;
  }

  if (!entryStat.isFile()) {
    return undefined;
  }

  const artifactRealPath = await input.filesystem.realpath(input.filePath);

  if (!isPathInside(input.runRoot, artifactRealPath)) {
    return {
      id: input.id,
      label: input.label,
      ...(input.groupLabel === undefined ? {} : { groupLabel: input.groupLabel }),
      preview: {
        kind: "unavailable",
        content:
          "Preview rejected because the reader document resolves outside the selected run directory.",
        truncated: false
      }
    };
  }

  return {
    id: input.id,
    label: input.label,
    ...(input.groupLabel === undefined ? {} : { groupLabel: input.groupLabel }),
    preview: await renderArtifactPreview({
      filesystem: input.filesystem,
      filePath: artifactRealPath
    })
  };
}

async function renderArtifactPreview(input: {
  filesystem: HistoryViewerFilesystem;
  filePath: string;
}): Promise<ArtifactPreview> {
  if (!isSupportedTextArtifact(input.filePath)) {
    return {
      kind: "unavailable",
      content: "Preview unavailable for unsupported reader document type.",
      truncated: false
    };
  }

  const fileBuffer = await input.filesystem.readFile(input.filePath);
  const truncated = fileBuffer.byteLength > PREVIEW_LIMIT_BYTES;
  const previewBuffer = truncated
    ? fileBuffer.subarray(0, PREVIEW_LIMIT_BYTES)
    : fileBuffer;
  const text = previewBuffer.toString("utf8");

  if (path.extname(input.filePath).toLowerCase() === ".md") {
    return {
      kind: "html",
      content: sanitizeHtml(markdownRenderer.render(text), SANITIZE_MARKDOWN_OPTIONS),
      truncated
    };
  }

  return {
    kind: "text",
    content: text,
    truncated
  };
}

async function writeSnapshotFile(input: {
  filesystem: HistoryViewerFilesystem;
  html: string;
  paths: UraniborgPaths;
  runId: string;
  timestamp: string;
}): Promise<string> {
  const snapshotDirectory = path.join(
    input.paths.appHomeDirectory,
    SNAPSHOT_DIRECTORY_NAME
  );
  const snapshotFile = path.join(
    snapshotDirectory,
    `${safeFileComponent(input.runId)}-${safeFileComponent(input.timestamp)}.html`
  );

  await input.filesystem.mkdir(snapshotDirectory);
  await input.filesystem.writeFile(snapshotFile, input.html);

  return snapshotFile;
}

function renderSnapshotHtml(view: SelectedRunSnapshotView): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(view.manifest.title)} - Uraniborg Run Snapshot</title>
  <style>${SNAPSHOT_CSS}${renderPanelVisibilityCss(view)}</style>
</head>
<body>
  <header class="masthead">
    <p class="eyebrow">Uraniborg run snapshot</p>
    <h1>${escapeHtml(view.manifest.title)}</h1>
    <p>Generated ${escapeHtml(view.generatedAt)} from local Markdown artifacts.</p>
  </header>
  <main class="layout">
    <aside class="sidebar">
      ${renderNavigation(view)}
    </aside>
    <section class="content">
      ${renderReaderInputs(view)}
      ${renderReaderPanels(view)}
    </section>
  </main>
</body>
</html>`;
}

function renderNavigation(view: SelectedRunSnapshotView): string {
  return `<nav aria-label="Reader sections">
  <label for="panel-summary">Summary</label>
  ${view.original === undefined ? "" : '<label for="panel-original">Original</label>'}
  ${view.iterationArtifacts.map(renderIterationNavigation).join("\n  ")}
  ${view.finalRefined === undefined ? "" : '<label for="panel-final-refined">Refined</label>'}
</nav>`;
}

function renderIterationNavigation(group: IterationArtifactGroup): string {
  return `<div class="nav-group">
    <p>Iteration ${group.iteration}</p>
    ${group.review === undefined ? "" : `<label for="panel-${escapeHtml(group.review.id)}">Review</label>`}
    ${group.refined === undefined ? "" : `<label for="panel-${escapeHtml(group.refined.id)}">Refined</label>`}
  </div>`;
}

function renderReaderInputs(view: SelectedRunSnapshotView): string {
  return [
    '<input checked class="reader-toggle" id="panel-summary" name="reader-panel" type="radio">',
    view.original === undefined
      ? ""
      : '<input class="reader-toggle" id="panel-original" name="reader-panel" type="radio">',
    ...view.iterationArtifacts.flatMap((group) => [
      group.review === undefined
        ? ""
        : `<input class="reader-toggle" id="panel-${escapeHtml(group.review.id)}" name="reader-panel" type="radio">`,
      group.refined === undefined
        ? ""
        : `<input class="reader-toggle" id="panel-${escapeHtml(group.refined.id)}" name="reader-panel" type="radio">`
    ]),
    view.finalRefined === undefined
      ? ""
      : '<input class="reader-toggle" id="panel-final-refined" name="reader-panel" type="radio">'
  ].join("\n");
}

function renderReaderPanels(view: SelectedRunSnapshotView): string {
  return [
    renderManifestSummary(view.manifest),
    view.original === undefined ? "" : renderReaderSection(view.original),
    ...view.iterationArtifacts.flatMap((group) => [
      group.review === undefined ? "" : renderReaderSection(group.review),
      group.refined === undefined ? "" : renderReaderSection(group.refined)
    ]),
    view.finalRefined === undefined ? "" : renderReaderSection(view.finalRefined)
  ].join("\n");
}

function renderPanelVisibilityCss(view: SelectedRunSnapshotView): string {
  return `${collectReaderPanels(view)
    .map(
      (_panel, index) =>
        `.reader-toggle:nth-of-type(${index + 1}):checked ~ .reader-panel:nth-of-type(${index + 1})`
    )
    .join(",\n")} {
  display: block;
}
`;
}

function collectReaderPanels(
  view: SelectedRunSnapshotView
): readonly (ReaderSection | "summary")[] {
  return [
    "summary",
    ...(view.original === undefined ? [] : [view.original]),
    ...view.iterationArtifacts.flatMap((group) => [
      ...(group.review === undefined ? [] : [group.review]),
      ...(group.refined === undefined ? [] : [group.refined])
    ]),
    ...(view.finalRefined === undefined ? [] : [view.finalRefined])
  ];
}

function renderManifestSummary(manifest: RunManifest): string {
  const errorMarkup =
    manifest.lastError === undefined
      ? ""
      : `<div class="summary-card danger">
        <h3>Last Error</h3>
        <dl>
          ${renderDefinition("Code", manifest.lastError.code)}
          ${renderDefinition("Message", manifest.lastError.message)}
          ${renderDefinition("Timestamp", manifest.lastError.timestamp)}
        </dl>
      </div>`;

  return `<article class="reader-panel summary-panel">
    <h2>Summary</h2>
    <dl class="summary-grid">
      ${renderDefinition("Run ID", manifest.runId)}
      ${renderDefinition("Title", manifest.title)}
      ${renderDefinition("Status", manifest.status)}
      ${renderDefinition("Phase", manifest.phase)}
      ${renderDefinition("Progress", `${manifest.iterationsCompleted}/${manifest.iterationsPlanned}`)}
      ${renderDefinition("Created", manifest.createdAt)}
      ${renderDefinition("Updated", manifest.updatedAt)}
      ${renderDefinition("Source", manifest.sourceInputPath)}
      ${renderDefinition("Review model", manifest.selectedModels.review)}
      ${renderDefinition("Refine model", manifest.selectedModels.refine)}
    </dl>
    ${errorMarkup}
  </article>`;
}

function renderReaderSection(section: ReaderSection): string {
  return `<article class="reader-panel">
    ${
      section.groupLabel === undefined
        ? `<h2>${escapeHtml(section.label)}</h2>`
        : `<p class="section-kicker">${escapeHtml(section.groupLabel)}</p><h2>${escapeHtml(section.label)}</h2>`
    }
    ${renderArtifactPreviewMarkup(section.preview)}
  </article>`;
}

function renderArtifactPreviewMarkup(preview: ArtifactPreview): string {
  const truncationNotice = preview.truncated
    ? `<p class="notice">Preview truncated at ${PREVIEW_LIMIT_BYTES} bytes.</p>`
    : "";

  switch (preview.kind) {
    case "html":
      return `${truncationNotice}<div class="markdown">${preview.content}</div>`;
    case "text":
      return `${truncationNotice}<pre>${escapeHtml(preview.content)}</pre>`;
    case "unavailable":
      return `<p class="notice">${escapeHtml(preview.content)}</p>`;
  }
}

function renderDefinition(term: string, value: string): string {
  return `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function isSupportedTextArtifact(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();

  return [".md", ".txt"].includes(extension);
}

function validateRunId(runId: string): void {
  if (runId.length === 0 || runId.includes("/") || runId.includes("\\")) {
    throw new Error(`Run "${runId}" was not found.`);
  }
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function safeFileComponent(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SNAPSHOT_CSS = `
:root {
  color: #17211b;
  background: #f7f1e3;
  font-family: Georgia, "Times New Roman", serif;
}
body {
  margin: 0;
}
.masthead {
  background: linear-gradient(135deg, #14342b, #315c49);
  color: #fff8e7;
  padding: 40px;
}
.eyebrow {
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.layout {
  display: grid;
  grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
}
.sidebar {
  align-self: start;
  position: sticky;
  top: 16px;
}
.sidebar nav {
  display: grid;
  gap: 8px;
}
.sidebar label {
  color: #315c49;
  cursor: pointer;
  display: block;
  padding: 6px 0;
}
.nav-group {
  border-left: 2px solid #dccfb4;
  margin: 6px 0;
  padding-left: 12px;
}
.nav-group p {
  color: #68796e;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  margin: 8px 0 4px;
  text-transform: uppercase;
}
.reader-toggle {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.reader-panel,
.summary-card {
  background: #fffaf0;
  border: 1px solid #dccfb4;
  border-radius: 14px;
  margin-bottom: 24px;
  padding: 24px;
  box-shadow: 0 12px 30px rgba(49, 92, 73, 0.08);
}
.reader-panel {
  display: none;
}
.danger {
  border-color: #a33a2a;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
dt {
  color: #68796e;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
.section-kicker {
  color: #68796e;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.markdown,
pre {
  background: #f5ecd9;
  border-radius: 10px;
  overflow: auto;
  padding: 16px;
}
pre,
code {
  font-family: "SFMono-Regular", Consolas, monospace;
}
.notice {
  color: #865f21;
  font-weight: 700;
}
@media (max-width: 760px) {
  .layout {
    display: block;
    padding: 16px;
  }
  .sidebar {
    position: static;
    margin-bottom: 16px;
  }
  .masthead {
    padding: 28px 20px;
  }
}
`;
