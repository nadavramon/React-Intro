import { createStore } from 'zustand/vanilla'
import type { Task } from '@/features/todo/types'
import { createTask, deleteTask, fetchTasks, updateTask } from '@/features/todo/api/tasksApi'

export type TodoStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TodoState = {
    tasks: Task[]

    status: TodoStatus
    errorMessage: string | null

    init: () => Promise<void>
    addTask: (title: string) => Promise<void>
    toggleTask: (id: string) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    deleteCompleted: () => Promise<void>
}

export type TodoStore = ReturnType<typeof createTodoStore>

export function createTodoStore() {
    return createStore<TodoState>((set, get) => ({
        tasks: [],
        status: 'idle',
        errorMessage: null,

        init: async () => {
            if (get().status !== 'idle') return
            set({ status: 'loading' })
            try {
                const tasks = await fetchTasks()
                set({ tasks, status: 'ready', errorMessage: null })
            } catch (err) {
                console.error('Failed to load tasks', err)
                set({
                    status: 'error',
                    errorMessage: 'Could not load tasks. Please try again.',
                })
            }
        },

        addTask: async (title: string) => {
            const trimmed = title.trim()
            if (trimmed === '') return
            try {
                const created = await createTask(trimmed)
                set((state) => ({ tasks: [...state.tasks, created] }))
            } catch (err) {
                console.error('Failed to add task', err)
                throw err
            }
        },

        toggleTask: async (id: string) => {
            const task = get().tasks.find((t) => t.id === id)
            if (!task) return
            try {
                const updated = await updateTask(id, { isCompleted: !task.isCompleted })
                set((state) => ({
                    tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
                }))
            } catch (err) {
                console.error('Failed to toggle task', err)
                throw err
            }
        },

        deleteTask: async (id: string) => {
            try {
                await deleteTask(id)
                set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }))
            } catch (err) {
                console.error('Failed to delete task', err)
                throw err
            }
        },

        deleteCompleted: async () => {
            const completed = get().tasks.filter((t) => t.isCompleted)
            try {
                await Promise.all(completed.map((t) => deleteTask(t.id)))
                set((state) => ({ tasks: state.tasks.filter((t) => !t.isCompleted) }))
            } catch (err) {
                console.error('Failed to delete completed tasks', err)
                throw err
            }
        },
    }))
}
