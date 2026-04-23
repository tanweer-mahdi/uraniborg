import { describe, expect, it } from "vitest";

import {
  createRunId,
  deriveRunTitleFromSourcePath,
  slugifyRunLabel
} from "../../src/run/slug.js";

describe("slug helpers", () => {
  it("creates stable ASCII slugs", () => {
    expect(slugifyRunLabel("Scaling Laws Draft")).toBe("scaling-laws-draft");
    expect(slugifyRunLabel("  ---  ")).toBe("run");
  });

  it("creates timestamped run ids in UTC-safe format", () => {
    expect(
      createRunId(new Date("2026-04-21T18:15:00Z"), "scaling-laws")
    ).toBe("2026-04-21T18-15-00Z-scaling-laws");
  });

  it("derives a readable title from the source path", () => {
    expect(deriveRunTitleFromSourcePath("/work/scaling-laws-draft.md")).toBe(
      "scaling laws draft"
    );
  });
});
