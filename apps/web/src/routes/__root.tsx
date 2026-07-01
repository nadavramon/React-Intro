import { useEffect } from 'react'
import { createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Layout from '@/layout/Layout/Layout'
import NotFoundPage from '@/pages/NotFoundPage'
import { Toaster } from '@/components/ui/sonner'
import { useTodoStore } from '@/features/todo'

export const Route = createRootRoute({
    component: RootComponent,
    notFoundComponent: NotFoundPage,
})

function RootComponent() {
    useEffect(() => {
        useTodoStore.getState().init()
    }, [])
    return (
        <>
            <Layout />
            <Toaster richColors position="top-right" />
            {import.meta.env.DEV && <TanStackRouterDevtools />}
        </>
    )
}
