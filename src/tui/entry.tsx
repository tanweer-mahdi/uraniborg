import React from "react";
import { render } from "ink";

import { UraniborgTuiApp } from "./app.js";
import type { TuiLaunchIntent } from "./types.js";

export async function launchInteractiveApp(
  intent: TuiLaunchIntent
): Promise<void> {
  const instance = render(<UraniborgTuiApp initialIntent={intent} />);
  await instance.waitUntilExit();
}
