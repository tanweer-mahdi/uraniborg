import { describe, expect, it } from "vitest";

import {
  appendInformationHighwayIteration,
  parseChangeSummarySections
} from "../../src/memory/information-highway.js";

describe("information highway", () => {
  it("parses the required change-summary sections", () => {
    const result = parseChangeSummarySections(`## Accepted reviewer points
- Tighten the introduction

## Rejected reviewer points
- Add invented numbers
Reason: Unsupported by the draft

## Changes made
- Rewrote the opening section

## Open issues
- Need stronger evaluation details

## Regression guards
- Do not reintroduce unsupported claims`);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.acceptedReviewerPoints).toContain(
        "Tighten the introduction"
      );
      expect(result.value.regressionGuards).toContain(
        "Do not reintroduce unsupported claims"
      );
    }
  });

  it("appends canonical iteration blocks and rejects missing sections", () => {
    const appendResult = appendInformationHighwayIteration({
      existingContents: "",
      iterationNumber: 2,
      changeSummary: `## Accepted reviewer points
- Clarify assumptions

## Rejected reviewer points
- Add unsupported benchmark
Reason: No evidence

## Changes made
- Added assumptions section

## Open issues
- Evaluation remains thin

## Regression guards
- Keep uncertainty language calibrated`
    });

    expect(appendResult.ok).toBe(true);

    if (appendResult.ok) {
      expect(appendResult.value).toContain("## Iteration 2");
      expect(appendResult.value).toContain("### Accepted reviewer points");
    }

    const invalidResult = appendInformationHighwayIteration({
      existingContents: "",
      iterationNumber: 1,
      changeSummary: "## Accepted reviewer points\n- Only one section"
    });

    expect(invalidResult.ok).toBe(false);
  });
});
