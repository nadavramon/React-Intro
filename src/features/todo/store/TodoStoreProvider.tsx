import { useEffect, useState, type ReactNode } from 'react'
import { createTodoStore } from './todoStore'
import { TodoStoreContext } from './todoStoreContext'

type Props = {
    children: ReactNode
}

export function TodoStoreProvider({ children }: Props) {
    const [store] = useState(() => createTodoStore())

    useEffect(() => {
        store.getState().init()
    }, [store])

    return <TodoStoreContext.Provider value={store}>{children}</TodoStoreContext.Provider>
}
