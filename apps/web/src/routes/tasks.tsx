import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import TodoPage, { useTodoStore } from '@/features/todo'

export const Route = createFileRoute('/tasks')({ component: TasksRoute })

function TasksRoute() {
    useEffect(() => {
        useTodoStore.getState().init()
    }, [])
    return <TodoPage />
}
