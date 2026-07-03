import { createRootRoute, redirect } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Layout from '@/layout/Layout/Layout'
import NotFoundPage from '@/pages/NotFoundPage'
import { Toaster } from '@/components/ui/sonner'
import { authClient } from '@/lib/authClient'

export const Route = createRootRoute({
    beforeLoad: async ({ location }) => {
        if (location.pathname === '/login') return
        const { data: session } = await authClient.getSession()
        if (!session) throw redirect({ to: '/login' })
    },
    component: RootComponent,
    notFoundComponent: NotFoundPage,
})

function RootComponent() {
    return (
        <>
            <Layout />
            <Toaster richColors position="top-right" />
            {import.meta.env.DEV && <TanStackRouterDevtools />}
        </>
    )
}
