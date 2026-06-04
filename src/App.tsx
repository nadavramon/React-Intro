import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './AppRoutes'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
            <Toaster richColors position="top-right" />
        </BrowserRouter>
    )
}
