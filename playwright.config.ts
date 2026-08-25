import { defineConfig, devices } from "@playwright/test";

const chromiumExecutable = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: process.env.CI ? "line" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.BASE_URL || "http://127.0.0.1:5000",
    trace: "retain-on-failure",
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:5000",
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          PORT: "5000",
        },
      },
});