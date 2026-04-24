import { err, ok, type Result } from "../types/result.js";

export const INFORMATION_HIGHWAY_SECTIONS = [
  "Accepted reviewer points",
  "Rejected reviewer points",
  "Changes made",
  "Open issues",
  "Regression guards"
] as const;

export type InformationHighwaySectionName =
  (typeof INFORMATION_HIGHWAY_SECTIONS)[number];

export interface ParsedChangeSummarySections {
  acceptedReviewerPoints: string;
  rejectedReviewerPoints: string;
  changesMade: string;
  openIssues: string;
  regressionGuards: string;
}

export interface InformationHighwayError {
  code: "changes_summary_invalid";
  message: string;
  details?: readonly string[] | undefined;
}

export function createInitialInformationHighway(): string {
  return "";
}

export function parseChangeSummarySections(
  changeSummary: string
): Result<ParsedChangeSummarySections, InformationHighwayError> {
  const normalized = changeSummary.replace(/\r\n/g, "\n").trim();

  const acceptedReviewerPoints = extractSectionContent(
    normalized,
    "Accepted reviewer points"
  );
  const rejectedReviewerPoints = extractSectionContent(
    normalized,
    "Rejected reviewer points"
  );
  const changesMade = extractSectionContent(normalized, "Changes made");
  const openIssues = extractSectionContent(normalized, "Open issues");
  const regressionGuards = extractSectionContent(normalized, "Regression guards");

  const missingSections = [
    acceptedReviewerPoints === null ? "Accepted reviewer points" : null,
    rejectedReviewerPoints === null ? "Rejected reviewer points" : null,
    changesMade === null ? "Changes made" : null,
    openIssues === null ? "Open issues" : null,
    regressionGuards === null ? "Regression guards" : null
  ].filter((value): value is string => typeof value === "string");

  if (missingSections.length > 0) {
    return err({
      code: "changes_summary_invalid",
      message:
        "Refinement change summary is missing one or more required sections.",
      details: missingSections
    });
  }

  return ok({
    acceptedReviewerPoints: acceptedReviewerPoints ?? "",
    rejectedReviewerPoints: rejectedReviewerPoints ?? "",
    changesMade: changesMade ?? "",
    openIssues: openIssues ?? "",
    regressionGuards: regressionGuards ?? ""
  });
}

export function formatInformationHighwayIterationBlock(input: {
  iterationNumber: number;
  sections: ParsedChangeSummarySections;
}): string {
  return [
    `## Iteration ${input.iterationNumber}`,
    "### Accepted reviewer points",
    input.sections.acceptedReviewerPoints,
    "",
    "### Rejected reviewer points",
    input.sections.rejectedReviewerPoints,
    "",
    "### Changes made",
    input.sections.changesMade,
    "",
    "### Open issues",
    input.sections.openIssues,
    "",
    "### Regression guards",
    input.sections.regressionGuards
  ].join("\n");
}

export function appendInformationHighwayIteration(input: {
  existingContents: string;
  iterationNumber: number;
  changeSummary: string;
}): Result<string, InformationHighwayError> {
  const parsedSections = parseChangeSummarySections(input.changeSummary);

  if (!parsedSections.ok) {
    return parsedSections;
  }

  const iterationBlock = formatInformationHighwayIterationBlock({
    iterationNumber: input.iterationNumber,
    sections: parsedSections.value
  });
  const trimmedExistingContents = input.existingContents.trim();

  return ok(
    trimmedExistingContents.length === 0
      ? `${iterationBlock}\n`
      : `${trimmedExistingContents}\n\n${iterationBlock}\n`
  );
}

function extractSectionContent(
  changeSummary: string,
  heading: InformationHighwaySectionName
): string | null {
  const escapedHeading = escapeRegExp(heading);
  const pattern = new RegExp(
    `^## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=^## |$)`,
    "mu"
  );
  const match = changeSummary.match(pattern);

  if (match === null) {
    return null;
  }

  return (match[1] ?? "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
