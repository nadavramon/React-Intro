import { useEffect } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import Layout from '@/layout/Layout/Layout'
import { authClient } from '@/lib/authClient'
import { useTodoStore } from '@/features/todo'

export const Route = createFileRoute('/_authed')({
    beforeLoad: async () => {
        let session
        try {
            ;({ data: session } = await authClient.getSession())
        } catch {
            // auth server unreachable — degrade gracefully instead of walling off
            // backend-free pages behind an error screen or a dead /login
            return
        }
        if (!session) throw redirect({ to: '/login' })
    },
    component: AuthedShell,
})

function AuthedShell() {
    useEffect(() => {
        useTodoStore.getState().init()
    }, [])
    return <Layout />
}
