import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    serviceWorkers: "allow",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/mobile-webkit.spec.ts",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "webkit-mobile",
      testMatch: ["**/mobile-webkit.spec.ts", "**/three-chapter-campaign.spec.ts"],
      use: { ...devices["iPhone 13"] }
    }
  ],
  webServer: {
    command: "node e2e/pwa-preview-server.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
