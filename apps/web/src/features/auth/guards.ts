import { redirect } from '@tanstack/react-router'
import { authClient } from './authClient'

export async function requireSession() {
    let session
    try {
        ;({ data: session } = await authClient.getSession())
    } catch {
        return
    }
    if (!session) throw redirect({ to: '/login' })
}

export async function redirectIfSignedIn() {
    const { data: session } = await authClient.getSession()
    if (session) throw redirect({ to: '/tasks' })
}
