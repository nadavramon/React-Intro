import { useState, useEffect, useMemo } from 'react'
import { Player, BOARD_SIZE, type Cell, type Move } from './ticTacToeLogic'

const STORAGE_KEY = 'tic-tac-toe-state'

export const INITIAL_BOARD: Cell[] = Array(BOARD_SIZE).fill(null)
export const FIRST_PLAYER: Player = Player.X
export const INITIAL_HISTORY: Move[] = []

type PersistedState = {
    board: Cell[]
    currentPlayer: Player
    history: Move[]
}

export function readPersistedState(): PersistedState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null)
            return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

export function usePersistedGameState() {
    const persisted = useMemo(() => readPersistedState(), [])

    const [board, setBoard] = useState<Cell[]>(persisted?.board ?? INITIAL_BOARD)
    const [currentPlayer, setCurrentPlayer] = useState<Player>(persisted?.currentPlayer ?? FIRST_PLAYER)
    const [history, setHistory] = useState<Move[]>(persisted?.history ?? INITIAL_HISTORY)

    useEffect(() => {
        const stateToPersist: PersistedState = { board, currentPlayer, history }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist))
    }, [board, currentPlayer, history])

    return { board, setBoard, currentPlayer, setCurrentPlayer, history, setHistory }
}
