import { useContext } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { TodoStoreContext } from './TodoStoreProvider'
import type { TodoState } from './todoStore'

export function useTodoStore<T>(selector: (state: TodoState) => T): T {
    const store = useContext(TodoStoreContext)
    if (store === null) throw new Error('useTodoStore must be used inside <TodoStoreProvider>')
    return useStore(store, selector)
}

export function useTodoActions() {
    return useTodoStore(
        useShallow((state) => ({
            addTask: state.addTask,
            toggleTask: state.toggleTask,
            deleteTask: state.deleteTask,
            deleteCompleted: state.deleteCompleted,
        })),
    )
}
