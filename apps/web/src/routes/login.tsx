import { createFileRoute, redirect } from '@tanstack/react-router'
import LoginPage from '@/pages/LoginPage'
import { authClient } from '@/lib/authClient'

export const Route = createFileRoute('/login')({
    beforeLoad: async () => {
        const { data: session } = await authClient.getSession()
        if (session) throw redirect({ to: '/tasks' })
    },
    component: LoginPage,
})
