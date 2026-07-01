import { useState, useEffect } from 'react'
import { Player, BOARD_SIZE, findWinner, isBoardFull, type Cell, type Move } from './ticTacToeLogic'

const STORAGE_KEY = 'tic-tac-toe-state'

const INITIAL_BOARD: Cell[] = Array(BOARD_SIZE).fill(null)
const FIRST_PLAYER: Player = Player.X
const INITIAL_HISTORY: Move[] = []

type GameState = {
    board: Cell[]
    currentPlayer: Player
    history: Move[]
}

const INITIAL_STATE: GameState = {
    board: INITIAL_BOARD,
    currentPlayer: FIRST_PLAYER,
    history: INITIAL_HISTORY,
}

function readGameState(): GameState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

export function useGameState() {
    const [gameState, setGameState] = useState<GameState>(() => readGameState() ?? INITIAL_STATE)
    const { board, currentPlayer, history } = gameState

    const result = findWinner(board)
    const winner = result?.winner ?? null
    const winningLine = result?.line ?? null
    const isDraw = winner === null && isBoardFull(board)
    const isGameOver = winner !== null || isDraw

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState))
    }, [gameState])

    function applyMove(index: number) {
        if (isGameOver || board[index] !== null) return
        setGameState((prev) => ({
            board: prev.board.map((cell, i) => (i === index ? prev.currentPlayer : cell)),
            currentPlayer: prev.currentPlayer === Player.X ? Player.O : Player.X,
            history: [...prev.history, { player: prev.currentPlayer, cellIndex: index }],
        }))
    }

    function resetGame() {
        setGameState(INITIAL_STATE)
    }

    return {
        board,
        currentPlayer,
        history,
        winner,
        winningLine,
        isDraw,
        isGameOver,
        applyMove,
        resetGame,
    }
}
