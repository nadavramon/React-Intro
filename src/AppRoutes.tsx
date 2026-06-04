import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/layout/Layout/Layout'
import CounterApp from '@/features/counter'
import TicTacToe from '@/features/tic-tac-toe'
import TodoPage from '@/features/todo'
import NotFoundPage from '@/pages/NotFoundPage'
import { ROUTES } from './routes'

export default function AppRoutes() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<Navigate to={ROUTES.counters} replace />} />
                <Route path={ROUTES.counters} element={<CounterApp />} />
                <Route path={ROUTES.ticTacToe} element={<TicTacToe />} />
                <Route path={ROUTES.todo} element={<TodoPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    )
}
