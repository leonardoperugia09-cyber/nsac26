import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "backend/tests",
  testMatch: "browser.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    launchOptions: {
      executablePath: process.env.HALO_CHROMIUM_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: [
    {
      command: "npm run preview -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "npm run server",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
