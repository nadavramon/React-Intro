import { createContext, useEffect, useRef, type ReactNode } from 'react'
import { createTodoStore, type TodoStore } from './todoStore'

export const TodoStoreContext = createContext<TodoStore | null>(null)

type Props = {
    children: ReactNode
}

export function TodoStoreProvider({ children }: Props) {
    const storeRef = useRef<TodoStore | null>(null)
    if (storeRef.current === null) storeRef.current = createTodoStore()

    useEffect(() => {
        storeRef.current!.getState().init()
    }, [])

    return (
        <TodoStoreContext.Provider value={storeRef.current}>{children}</TodoStoreContext.Provider>
    )
}
