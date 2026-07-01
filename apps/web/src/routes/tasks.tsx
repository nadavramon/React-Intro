import { createFileRoute } from '@tanstack/react-router'
import TodoPage from '@/features/todo'

export const Route = createFileRoute('/tasks')({ component: TodoPage })
