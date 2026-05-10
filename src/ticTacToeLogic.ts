export enum Player {
    X = 'X',
    O = 'O',
}

export type Cell = Player | null
export type Move = {
    player: Player
    cellIndex: number
}

export type WinResult = {
    winner: Player
    line: number[]
}

const BOARD_WIDTH = 3
export const BOARD_SIZE = BOARD_WIDTH * BOARD_WIDTH

const WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
]

export function findWinner(board: Cell[]): WinResult | null {
    for (const line of WINNING_LINES) {
        const [a, b, c] = line
        const cellA = board[a]
        if (cellA === null) continue
        if (cellA === board[b] && cellA === board[c])
            return { winner: cellA, line }
    }
    return null
}

export const isBoardFull = (board: Cell[]): boolean =>
    board.every(cell => cell !== null)
