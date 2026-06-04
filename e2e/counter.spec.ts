import { test, expect } from '@playwright/test'

// Example end-to-end test: drives a real browser against the running dev server.
// `baseURL` and the auto-started dev server come from playwright.config.ts.

test('home redirects to the counters page', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/counters$/)
    await expect(page.getByRole('heading', { name: 'Click Counters' })).toBeVisible()
})

test('clicking a counter updates that counter and the total', async ({ page }) => {
    await page.goto('/counters')

    // The total pill starts at 0.
    const total = page.getByTestId('total-value')
    await expect(total).toHaveText('0')

    // Counter "#1": match its label exactly so it doesn't also hit #10/#11/#12.
    // Clicking the label bubbles to the button's onClick.
    const firstCounter = page.getByText('#1', { exact: true })
    await firstCounter.click()
    await firstCounter.click()

    await expect(total).toHaveText('2')
})
