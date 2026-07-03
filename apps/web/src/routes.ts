export const ROUTES = {
    counters: '/counters',
    ticTacToe: '/tic-tac-toe',
    todo: '/tasks',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
