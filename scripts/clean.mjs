#!/usr/bin/env node

import { rmSync } from "node:fs";

for (const target of ["dist", "coverage"]) {
  rmSync(target, { recursive: true, force: true });
}
