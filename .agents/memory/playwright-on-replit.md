---
name: Playwright on Replit
description: How this project’s Playwright suite locates its browser in the Replit workspace.
---

Configure Playwright’s `launchOptions.executablePath` from the Replit-provided Chromium executable environment variable when it is available.

**Why:** Playwright’s downloaded browser cache is not guaranteed to exist in the workspace, whereas Replit provides a compatible executable. Putting the path at the wrong configuration level is ignored and causes launch failures.

**How to apply:** Keep the project’s Playwright configuration aligned with this approach when changing browser projects or launch settings, and validate with the actual E2E command.