import { test, expect } from '@playwright/test'
import { mockTasksApi } from './helpers/mockTasksApi'

test.beforeEach(async ({ page }) => {
    await mockTasksApi(page, [{ id: 'seed-1', title: 'Seeded task', isCompleted: false }])
})

test('navigating away from /tasks and back does not refetch GET /tasks', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.getByText('Loading tasks…')).toBeHidden()

    const getTasksAfterLoad: string[] = []
    page.on('request', (req) => {
        const url = new URL(req.url())
        if (
            req.method() === 'GET' &&
            url.pathname === '/tasks' &&
            req.resourceType() !== 'document'
        ) {
            getTasksAfterLoad.push(req.url())
        }
    })

    await page.getByRole('link', { name: 'Tic-Tac-Toe' }).click()
    await expect(page).toHaveURL(/tic-tac-toe$/)

    await page.getByRole('link', { name: 'Todo' }).click()
    await expect(page).toHaveURL(/tasks$/)
    await expect(page.getByText('Loading tasks…')).toBeHidden()

    expect(getTasksAfterLoad).toHaveLength(0)
})

test('Sidebar badge is hydrated on a fresh load of a non-todo page', async ({ page }) => {
    await page.goto('/counters')
    await expect(page.getByLabel(/active tasks/)).toBeVisible()
})

test('Sidebar badge updates in real time as a task is toggled', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible()

    const title = `Badge test ${Date.now()}`

    await page.getByRole('textbox', { name: 'New task' }).fill(title)
    await page.getByRole('button', { name: 'Add' }).click()

    const taskRow = page.getByRole('listitem').filter({ hasText: title })
    await expect(taskRow).toBeVisible()

    const badge = page.getByLabel(/\d+ active tasks?/)
    await expect(badge).toBeVisible()

    const beforeText = await badge.textContent()
    const before = Number(beforeText)

    const checkbox = taskRow.getByRole('checkbox')

    await checkbox.click()
    await expect(checkbox).toBeChecked()

    if (before === 1) {
        await expect(badge).toBeHidden()
    } else {
        await expect(badge).toHaveText(String(before - 1))
    }

    await checkbox.click()
    await expect(checkbox).not.toBeChecked()
    await expect(badge).toHaveText(String(before))
})
