import { redirect } from '@tanstack/react-router'
import { authClient } from './authClient'

export async function requireSession() {
    const result = await authClient.getSession().catch(() => null)
    if (result && !result.data) throw redirect({ to: '/login' })
}

export async function redirectIfSignedIn() {
    const { data: session } = await authClient.getSession()
    if (session) throw redirect({ to: '/tasks' })
}
