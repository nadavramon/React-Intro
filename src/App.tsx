import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './AppRoutes'
import { Toaster } from '@/components/ui/sonner'
import { useTodoStore } from '@/features/todo'

export default function App() {
    useEffect(() => {
        useTodoStore.getState().init()
    }, [])

    return (
        <BrowserRouter>
            <AppRoutes />
            <Toaster richColors position="top-right" />
        </BrowserRouter>
    )
}
