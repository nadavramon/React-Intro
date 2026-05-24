import { Routes, Route, Navigate, BrowserRouter } from 'react-router-dom'
import Layout from './layout/Layout/Layout'
import CounterApp from './features/counter'
import TicTacToe from './features/tic-tac-toe'
import TodoPage from './features/todo'
import NotFoundPage from './pages/NotFoundPage/NotFoundPage'

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout />}>
                    <Route index element={<Navigate to="/counters" replace />} />
                    <Route path="counters" element={<CounterApp />} />
                    <Route path="tic-tac-toe" element={<TicTacToe />} />
                    <Route path="todo" element={<TodoPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
