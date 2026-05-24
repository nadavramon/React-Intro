import { useState } from 'react'
import type { Task } from './types'

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([])

    const total = tasks.length
    const completed = tasks.filter((task) => task.isCompleted).length
    const active = total - completed

    function addTask(title: string) {
        const trimmed = title.trim()
        if (trimmed === '') return
        const newTask: Task = {
            id: crypto.randomUUID(),
            title: trimmed,
            isCompleted: false,
        }
        setTasks((prev) => [...prev, newTask])
    }

    function toggleTask(id: string) {
        setTasks((prev) =>
            prev.map((task) => (task.id === id ? { ...task, isCompleted: !task.isCompleted } : task)),
        )
    }

    function deleteCompleted() {
        setTasks((prev) => prev.filter((task) => !task.isCompleted))
    }

    return { tasks, total, active, completed, addTask, toggleTask, deleteCompleted }
}
