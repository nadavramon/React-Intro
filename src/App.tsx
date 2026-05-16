import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layout/Layout'
import CountersPage from './pages/CountersPage'
import TicTacToePage from './pages/TicTacToePage'
import TodoPage from './pages/TodoPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<Navigate to="/counters" replace />} />
                <Route path="counters" element={<CountersPage />} />
                <Route path="tic-tac-toe" element={<TicTacToePage />} />
                <Route path="todo" element={<TodoPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    )
}
