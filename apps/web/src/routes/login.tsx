import { createFileRoute } from '@tanstack/react-router'
import { LoginPage, redirectIfSignedIn } from '@/features/auth'

export const Route = createFileRoute('/login')({
    beforeLoad: redirectIfSignedIn,
    component: LoginPage,
})
