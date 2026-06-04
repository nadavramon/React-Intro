// Runs once before the test suite (configured as `setupFiles` in vite.config.ts).
// Extends Vitest's `expect` with jest-dom matchers like `toBeInTheDocument()`,
// and auto-cleans the rendered DOM between tests.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
    cleanup()
})
