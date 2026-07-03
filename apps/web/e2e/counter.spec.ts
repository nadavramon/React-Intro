import { test, expect } from '@playwright/test'
import { mockTasksApi } from './helpers/mockTasksApi'

// The TodoStoreProvider wraps the whole app, so its init() fires even on
// /counters. Mock the tasks API so counter tests don't depend on a backend.
test.beforeEach(async ({ page }) => {
    await mockTasksApi(page)
})

test('home redirects to the counters page', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/counters$/)
    await expect(page.getByRole('heading', { name: 'Click Counters' })).toBeVisible()
})

test('clicking a counter updates that counter and the total', async ({ page }) => {
    await page.goto('/counters')

    const total = page.getByTestId('total-value')
    await expect(total).toHaveText('0')

    const firstCounter = page.getByText('#1', { exact: true })
    await firstCounter.click()
    await firstCounter.click()

    await expect(total).toHaveText('2')
})
