import { api } from '@/lib/api'
import type { Task, UpdateTaskBody } from '@repo/shared'

export async function fetchTasks(): Promise<Task[]> {
    const response = await api.get<Task[]>('/tasks')
    return response.data
}

export async function createTask(title: string): Promise<Task> {
    const response = await api.post<Task>('/tasks', { title })
    return response.data
}

export async function updateTask(id: string, changes: UpdateTaskBody): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}`, changes)
    return response.data
}

export async function deleteTask(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`)
}
