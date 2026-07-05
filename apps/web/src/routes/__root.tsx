import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import NotFoundPage from '@/pages/NotFoundPage'
import { Toaster } from '@/components/ui/sonner'

export const Route = createRootRoute({
    component: RootComponent,
    notFoundComponent: NotFoundPage,
})

function RootComponent() {
    return (
        <>
            <Outlet />
            <Toaster richColors position="top-right" />
            {import.meta.env.DEV && <TanStackRouterDevtools />}
        </>
    )
}
