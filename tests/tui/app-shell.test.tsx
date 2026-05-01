import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { UraniborgTuiApp } from "../../src/tui/app.js";

describe("UraniborgTuiApp shell", () => {
  it("renders the reordered primary dashboard without the Ink subtitle", () => {
    const app = render(
      <UraniborgTuiApp
        initialIntent={{
          route: {
            kind: "dashboard"
          }
        }}
      />
    );

    const frame = app.lastFrame();

    expect(frame).toContain("Uraniborg");
    expect(frame).not.toContain("Ink primary UI");
    expect(frame).toContain("Doctor");
    expect(frame).toContain("Models");
    expect(frame).toContain("Config");
    expect(frame).toContain("Run");
    expect(frame).toContain("History");
    expect(frame?.indexOf("Doctor")).toBeLessThan(frame?.indexOf("Models") ?? 0);
    expect(frame?.indexOf("Models")).toBeLessThan(frame?.indexOf("Config") ?? 0);
    expect(frame?.indexOf("Config")).toBeLessThan(frame?.indexOf("Run") ?? 0);
    expect(frame?.indexOf("Run")).toBeLessThan(frame?.indexOf("History") ?? 0);

    app.unmount();
  });
});
