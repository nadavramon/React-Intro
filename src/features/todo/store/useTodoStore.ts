import { useContext } from 'react'
import { useStore } from 'zustand'
import { TodoStoreContext } from './todoStoreContext'
import type { TodoState } from './todoStore'

export function useTodoStore<T>(selector: (state: TodoState) => T): T {
    const store = useContext(TodoStoreContext)
    if (store === null) throw new Error('useTodoStore must be used inside <TodoStoreProvider>')
    return useStore(store, selector)
}

export const useAddTask = () => useTodoStore((s) => s.addTask)
export const useToggleTask = () => useTodoStore((s) => s.toggleTask)
export const useDeleteTask = () => useTodoStore((s) => s.deleteTask)
export const useDeleteCompleted = () => useTodoStore((s) => s.deleteCompleted)
