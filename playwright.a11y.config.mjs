import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.A11Y_PORT || 4180)
const baseURL = `http://127.0.0.1:${port}`
const dataDir =
  process.env.A11Y_DATA_DIR ||
  `.qa/a11y-data-${process.env.GITHUB_RUN_ID || process.pid}`

export default defineConfig({
  testDir: './tests/a11y',
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run serve',
    env: {
      HOST: '127.0.0.1',
      PORT: String(port),
      OPENFORMS_DATA_DIR: dataDir,
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
})
