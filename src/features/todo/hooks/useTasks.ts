import { useEffect, useState } from 'react'
import type { Task } from '@/features/todo/types'
import { createTask, deleteTask, fetchTasks, updateTask } from '@/features/todo/api/tasksApi'
import { toast } from 'sonner'

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchTasks()
            .then((loadedTasks) => {
                setTasks(loadedTasks)
                setError(null)
            })
            .catch((err) => {
                console.error('Failed to load tasks', err)
                setError('Could not load tasks. Please try again.')
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    async function addTask(title: string) {
        const trimmed = title.trim()
        if (trimmed === '') return
        try {
            const created = await createTask(trimmed)
            setTasks((prev) => [...prev, created])
            toast.success('Task added')
        } catch (err) {
            console.error('Failed to add task', err)
            toast.error('Failed to add task')
        }
    }

    async function toggleTask(id: string) {
        const task = tasks.find((task) => task.id === id)
        if (!task) return
        try {
            const updated = await updateTask(id, { isCompleted: !task.isCompleted })
            setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)))
            toast.success(updated.isCompleted ? 'Task completed' : 'Task marked active')
        } catch (err) {
            console.error('Failed to toggle task', err)
            toast.error('Failed to update task')
        }
    }

    async function deleteCompleted() {
        const completedTasks = tasks.filter((task) => task.isCompleted)
        try {
            await Promise.all(completedTasks.map((task) => deleteTask(task.id)))
            setTasks((prev) => prev.filter((task) => !task.isCompleted))
            const n = completedTasks.length
            toast.success(`Deleted ${n} task${n === 1 ? '' : 's'}`)
        } catch (err) {
            console.error('Failed to delete task', err)
            toast.error('Failed to delete tasks')
        }
    }

    return { tasks, loading, error, addTask, toggleTask, deleteCompleted }
}
