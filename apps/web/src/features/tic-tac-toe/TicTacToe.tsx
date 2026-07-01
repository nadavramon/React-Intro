import { useEffect } from 'react'
import { useGameState } from './useGameState'
import MoveHistory from './MoveHistory/MoveHistory'
import Board from './Board/Board'
import StatusBar from './StatusBar/StatusBar'

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
        <main className="mx-auto flex min-h-full max-w-4xl flex-col items-center gap-8 px-6 py-14">
            <header className="flex flex-col items-center gap-2">
                <h1 className="text-3xl font-bold text-foreground">Tic-Tac-Toe</h1>
                <p className="text-muted-foreground text-sm">Classic two-player strategy game</p>
            </header>
            <div className="flex flex-col items-center gap-6 xl:grid xl:grid-cols-[auto_280px] xl:items-start">
                <section className="flex flex-col gap-4">
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
