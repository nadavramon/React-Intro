import { useState } from 'react'
import type { Task } from './types'

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([])

    const total = tasks.length
    const completed = tasks.filter((task) => task.done).length
    const active = total - completed

    function addTask(text: string) {
        const trimmed = text.trim()
        if (trimmed === '') return
        const newTask: Task = {
            id: crypto.randomUUID(),
            text: trimmed,
            done: false,
        }
        setTasks((prev) => [...prev, newTask])
    }

    function toggleTask(id: string) {
        setTasks((prev) =>
            prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
        )
    }

    function deleteCompleted() {
        setTasks((prev) => prev.filter((task) => !task.done))
    }

    return { tasks, total, active, completed, addTask, toggleTask, deleteCompleted }
}
