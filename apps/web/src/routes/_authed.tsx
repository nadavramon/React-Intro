import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import Layout from '@/layout/Layout/Layout'
import { requireSession } from '@/features/auth'
import { useTodoStore } from '@/features/todo'

export const Route = createFileRoute('/_authed')({
    beforeLoad: requireSession,
    component: AuthedShell,
})

function AuthedShell() {
    useEffect(() => {
        useTodoStore.getState().init()
    }, [])
    return <Layout />
}
