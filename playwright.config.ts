import { defineConfig, devices } from "@playwright/test"

const PORT = 4310
const PROCESS_ENV: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ),
)

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "line",
  timeout: 60_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        headless: false,
        launchOptions: {
          env: {
            ...PROCESS_ENV,
            LIBGL_ALWAYS_SOFTWARE: "1",
            MOZ_WEBRENDER: "1",
          },
          firefoxUserPrefs: {
            "webgl.disabled": false,
            "webgl.force-enabled": true,
            "webgl2.force-enabled": true,
            "layers.acceleration.force-enabled": true,
            "gfx.webrender.software": true,
          },
        },
      },
    },
  ],
  webServer: {
    command: `npx vite --config e2e/vite.config.ts`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
