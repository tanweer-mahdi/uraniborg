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
    expect(frame).toContain("█");
    expect(frame).not.toContain("Ink primary UI");
    expect(frame).toContain("What is Uraniborg?");
    expect(frame).not.toContain("What is Uraniborg? —");
    expect(frame).toContain("Doctor");
    expect(frame).toContain("Models");
    expect(frame).toContain("Config");
    expect(frame).toContain("RunLoop");
    expect(frame).toContain("History");
    expect(frame).not.toContain("Loop readiness");
    expect(frame).not.toContain(
      "Current models for peer-review and refinement"
    );
    expect(frame).not.toContain(
      "Configure peer-review and refinement backends"
    );
    expect(frame).not.toContain("Point at your draft and run the loop");
    expect(frame).not.toContain("Examine prior loop runs");
    expect(frame?.indexOf("What is Uraniborg?")).toBeLessThan(
      frame?.indexOf("Doctor") ?? 0
    );
    expect(frame?.indexOf("Doctor")).toBeLessThan(frame?.indexOf("Models") ?? 0);
    expect(frame?.indexOf("Models")).toBeLessThan(frame?.indexOf("Config") ?? 0);
    expect(frame?.indexOf("Config")).toBeLessThan(frame?.indexOf("Run") ?? 0);
    expect(frame?.indexOf("Run")).toBeLessThan(frame?.indexOf("History") ?? 0);

    app.unmount();
  });

  it("renders the about route copy", () => {
    const app = render(
      <UraniborgTuiApp
        initialIntent={{
          route: {
            kind: "about"
          }
        }}
      />
    );

    const frame = app.lastFrame();

    expect(frame).toContain("iterative peer-review and refinement loop");
    expect(frame).toContain("Feynman as the peer-review backend");
    expect(frame).toContain("https://www.feynman.is/");

    app.unmount();
  });
});
