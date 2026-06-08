import type { Page } from '@playwright/test'

type Task = { id: string; title: string; isCompleted: boolean }

export async function mockTasksApi(page: Page, initialTasks: Task[] = []) {
    let tasks = [...initialTasks]

    await page.route('**/auth/login', (route) =>
        route.fulfill({
            json: { accessToken: 'mock-access', refreshToken: 'mock-refresh' },
        }),
    )

    await page.route('**/tasks', async (route) => {
        const req = route.request()

        if (req.resourceType() === 'document') return route.fallback()

        if (req.method() === 'GET') {
            return route.fulfill({ json: tasks })
        }
        if (req.method() === 'POST') {
            const body = req.postDataJSON() as { title: string }
            const created: Task = {
                id: `mock-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                title: body.title,
                isCompleted: false,
            }
            tasks.push(created)
            return route.fulfill({ status: 201, json: created })
        }
        return route.fallback()
    })

    await page.route('**/tasks/*', async (route) => {
        const req = route.request()
        const id = new URL(req.url()).pathname.split('/').pop()!

        if (req.method() === 'PUT') {
            const body = req.postDataJSON() as Partial<Task>
            tasks = tasks.map((t) => (t.id === id ? { ...t, ...body } : t))
            const updated = tasks.find((t) => t.id === id)
            return route.fulfill({ json: updated })
        }
        if (req.method() === 'DELETE') {
            tasks = tasks.filter((t) => t.id !== id)
            return route.fulfill({ status: 204 })
        }
        return route.fallback()
    })
}
