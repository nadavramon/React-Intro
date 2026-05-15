import { useEffect } from 'react'
import { findWinner, isBoardFull } from './ticTacToeLogic'
import { usePersistedGameState } from './useGameState'
import MoveHistory from './MoveHistory'
import Board from './Board'
import StatusBar from './StatusBar'
import './TicTacToe.css'

export default function TicTacToe() {
    const { board, currentPlayer, history, applyMove, resetGame } = usePersistedGameState()

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.repeat) return
            if (event.ctrlKey || event.metaKey || event.altKey) return
            if (event.key.toLowerCase() !== 'r') return
            resetGame()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const result = findWinner(board)
    const winner = result?.winner ?? null
    const winningLine = result?.line ?? null
    const isDraw = winner === null && isBoardFull(board)
    const isGameOver = winner !== null || isDraw

    function handleSquareClick(index: number) {
        if (isGameOver || board[index] !== null) return
        applyMove(index)
    }

    return (
        <main className="tic-tac-toe">
            <header className="ttt-header">
                <h1 className="ttt-title">Tic-Tac-Toe</h1>
                <p className="ttt-subtitle">Classic two-player strategy game</p>
            </header>
            <div className="ttt-layout">
                <section className="ttt-game">
                    <StatusBar
                        winner={winner}
                        isDraw={isDraw}
                        currentPlayer={currentPlayer}
                        onRestart={resetGame}
                    />
                    <Board
                        board={board}
                        winningLine={winningLine}
                        isGameOver={isGameOver}
                        onSquareClick={handleSquareClick}
                    />
                </section>
                <MoveHistory history={history} />
            </div>
        </main>
    )
}
