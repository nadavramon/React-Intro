import { useEffect, useState } from 'react'
import type { Task } from '../types'
import { createTask, deleteTask, fetchTasks, updateTask } from '../api/tasksApi'

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

    const total = tasks.length
    const completed = tasks.filter((task) => task.isCompleted).length
    const active = total - completed

    async function addTask(title: string) {
        const trimmed = title.trim()
        if (trimmed === '') return
        try {
            const created = await createTask(trimmed)
            setTasks((prev) => [...prev, created])
        } catch (err) {
            console.error('Failed to add task', err)
        }
    }

    async function toggleTask(id: string) {
        const task = tasks.find((task) => task.id === id)
        if (!task) return
        try {
            const updated = await updateTask(id, { isCompleted: !task.isCompleted })
            setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)))
        } catch (err) {
            console.error('Failed to toggle task', err)
        }
    }

    async function deleteCompleted() {
        const completedTasks = tasks.filter((task) => task.isCompleted)
        try {
            await Promise.all(completedTasks.map((task) => deleteTask(task.id)))
            setTasks((prev) => prev.filter((task) => !task.isCompleted))
        } catch (err) {
            console.error('Failed to delete task', err)
        }
    }

    return { tasks, total, active, completed, loading, error, addTask, toggleTask, deleteCompleted }
}
