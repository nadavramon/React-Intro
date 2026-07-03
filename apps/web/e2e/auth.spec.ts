import { test, expect } from '@playwright/test'
import { mockAuthSession, mockTasksApi } from './helpers/mockTasksApi'

test('unauthenticated visit is walled off to /login', async ({ page }) => {
    await mockAuthSession(page, null)
    await page.goto('/tasks')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: /connect via google/i })).toBeVisible()
    // the app shell (sidebar nav) must not frame the login screen
    await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('authenticated user passes the guard and sees the header account', async ({ page }) => {
    await mockTasksApi(page)
    await page.goto('/tasks')
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
})
