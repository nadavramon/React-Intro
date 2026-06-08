import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './AppRoutes'
import { Toaster } from '@/components/ui/sonner'
import { TodoStoreProvider } from '@/features/todo'

export default function App() {
    return (
        <BrowserRouter>
            <TodoStoreProvider>
                <AppRoutes />
            </TodoStoreProvider>
            <Toaster richColors position="top-right" />
        </BrowserRouter>
    )
}
