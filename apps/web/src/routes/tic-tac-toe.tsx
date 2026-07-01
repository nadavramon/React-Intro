import { createFileRoute } from '@tanstack/react-router'
import TicTacToe from '@/features/tic-tac-toe'

export const Route = createFileRoute('/tic-tac-toe')({ component: TicTacToe })
