import { useEffect } from 'react'
import { useGameState } from './useGameState'
import MoveHistory from './MoveHistory/MoveHistory'
import Board from './Board/Board'
import StatusBar from './StatusBar/StatusBar'
import styles from './TicTacToe.module.css'

export default function TicTacToe() {
    const {
        board,
        currentPlayer,
        history,
        winner,
        winningLine,
        isDraw,
        isGameOver,
        applyMove,
        resetGame,
    } = useGameState()

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.repeat) return
            if (event.ctrlKey || event.metaKey || event.altKey) return
            if (event.key.toLowerCase() !== 'r') return
            resetGame()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <main className={styles.ticTacToe}>
            <header className={styles.header}>
                <h1 className={styles.title}>Tic-Tac-Toe</h1>
                <p className={styles.subtitle}>Classic two-player strategy game</p>
            </header>
            <div className={styles.layout}>
                <section className={styles.game}>
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
                        onSquareClick={applyMove}
                    />
                </section>
                <MoveHistory history={history} />
            </div>
        </main>
    )
}
