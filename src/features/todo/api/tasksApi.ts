import { api } from '@/lib/api'
import type { Task } from '@/features/todo/types'

export async function fetchTasks(): Promise<Task[]> {
    const response = await api.get<Task[]>('/tasks')
    return response.data
}

export async function createTask(title: string): Promise<Task> {
    const response = await api.post<Task>('/tasks', { title })
    return response.data
}

export async function updateTask(
    id: string,
    changes: { title?: string; isCompleted?: boolean },
): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}`, changes)
    return response.data
}

export async function deleteTask(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`)
}
