import { useState, useEffect, useMemo } from 'react'
import { Player, BOARD_SIZE, type Cell, type Move } from './ticTacToeLogic'

const STORAGE_KEY = 'tic-tac-toe-state'

const INITIAL_BOARD: Cell[] = Array(BOARD_SIZE).fill(null)
const FIRST_PLAYER: Player = Player.X
const INITIAL_HISTORY: Move[] = []

type PersistedState = {
    board: Cell[]
    currentPlayer: Player
    history: Move[]
}

function readPersistedState(): PersistedState | null {
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

    function applyMove(index: number) {
        const nextBoard = board.map((cell, i) => i === index ? currentPlayer : cell)
        const nextPlayer = currentPlayer === Player.X ? Player.O : Player.X
        const newMove: Move = { player: currentPlayer, cellIndex: index }
        setBoard(nextBoard)
        setCurrentPlayer(nextPlayer)
        setHistory([...history, newMove])
    }

    function resetGame() {
        setBoard(INITIAL_BOARD)
        setCurrentPlayer(FIRST_PLAYER)
        setHistory(INITIAL_HISTORY)
    }

    return { board, currentPlayer, history, applyMove, resetGame }
}
