import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layout/Layout'
import CounterApp from './counter/CounterApp'
import TicTacToe from './tic-tac-toe/TicTacToe'
import TodoPage from './todo/TodoPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<Navigate to="/counters" replace />} />
                <Route path="counters" element={<CounterApp />} />
                <Route path="tic-tac-toe" element={<TicTacToe />} />
                <Route path="todo" element={<TodoPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    )
}
