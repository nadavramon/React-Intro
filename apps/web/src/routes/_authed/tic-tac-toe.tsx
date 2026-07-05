import { createFileRoute } from '@tanstack/react-router'
import TicTacToe from '@/features/tic-tac-toe'

export const Route = createFileRoute('/_authed/tic-tac-toe')({ component: TicTacToe })
