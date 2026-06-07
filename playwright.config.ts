import { defineConfig, devices } from '@playwright/test'

// E2E tests (real browser) live in ./e2e and run via `npm run test:e2e`.
// These are separate from the Vitest unit/component tests in src/ (*.test.tsx).
const PORT = 5173
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    // Run e2e serially: the dev backend is a single Express process and gets
    // unhappy under concurrent auth-then-fetch flows from separate browser
    // contexts. The suite is small (~5s serial), so reliability beats parallel.
    workers: 1,
    // Fail the build on CI if test.only was left in the source.
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL,
        // Capture a trace on first retry to debug failures.
        trace: 'on-first-retry',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    // Auto-start the Vite dev server before tests, and reuse it locally if it's
    // already running (so you don't fight an existing `npm run dev`).
    webServer: {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
})
