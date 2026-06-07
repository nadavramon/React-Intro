import { createContext } from 'react'
import type { TodoStore } from './todoStore'

export const TodoStoreContext = createContext<TodoStore | null>(null)
