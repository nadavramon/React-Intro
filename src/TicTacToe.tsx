import { useEffect } from 'react'
import { findWinner, isBoardFull, Player, type Move } from './ticTacToeLogic'
import { INITIAL_BOARD, FIRST_PLAYER, INITIAL_HISTORY, usePersistedGameState } from './useGameState'
import Square from './Square'
import './TicTacToe.css'

export default function TicTacToe() {
    const { board, setBoard, currentPlayer, setCurrentPlayer, history, setHistory } = usePersistedGameState()

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.repeat) return
            if (event.ctrlKey || event.metaKey || event.altKey) return
            if (event.key.toLowerCase() !== 'r') return

            setBoard(INITIAL_BOARD)
            setCurrentPlayer(FIRST_PLAYER)
            setHistory(INITIAL_HISTORY)
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

        const nextBoard = board.map((cell, i) => i === index ? currentPlayer : cell)
        const nextPlayer = currentPlayer === Player.X ? Player.O : Player.X
        const newMove: Move = { player: currentPlayer, cellIndex: index }

        setBoard(nextBoard)
        setCurrentPlayer(nextPlayer)
        setHistory([...history, newMove])
    }

    function handleRestart() {
        setBoard(INITIAL_BOARD)
        setCurrentPlayer(FIRST_PLAYER)
        setHistory(INITIAL_HISTORY)
    }

    function renderStatus() {
        if (winner !== null) {
            return (
                <>Winner: <span className={`ttt-status-player ttt-status-player-${winner.toLowerCase()}`}>{winner}</span></>
            )
        }
        if (isDraw) return <>Draw!</>
        return (
            <>Turn: <span className={`ttt-status-player ttt-status-player-${currentPlayer.toLowerCase()}`}>{currentPlayer}</span></>
        )
    }

    function renderHistoryItem(move: Move, index: number) {
        const moveNumber = index + 1
        const position = move.cellIndex + 1
        const isLatest = index === history.length - 1

        return (
            <li key={index} className={`history-item${isLatest ? ' history-item-latest' : ''}`}>
                Move #{moveNumber} - {move.player} -&gt; pos {position}
            </li>
        )
    }

    return (
        <main className="tic-tac-toe">
            <header className="ttt-header">
                <h1 className="ttt-title">Tic-Tac-Toe</h1>
                <p className="ttt-subtitle">Classic two-player strategy game</p>
            </header>
            <div className="ttt-layout">
                <section className="ttt-game">
                    <div className="ttt-statusbar">
                        <div className="ttt-status">
                            <svg className="ttt-status-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20" aria-hidden="true">
                                <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" clipRule="evenodd" />
                            </svg>
                            <span className="ttt-status-text">{renderStatus()}</span>
                        </div>

                        <button className="ttt-restart" type="button" onClick={handleRestart}>
                            <svg className="ttt-restart-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Restart
                        </button>
                    </div>

                    <div className="ttt-board">
                        {board.map((value, i) => (
                            <Square
                                key={i}
                                value={value}
                                isWinning={winningLine?.includes(i) ?? false}
                                isGameOver={isGameOver}
                                onClick={() => handleSquareClick(i)}
                            />
                        ))}
                    </div>
                </section>

                <aside className="ttt-history">
                    <h2 className="ttt-history-title">Move history</h2>
                    {history.length === 0 ? (
                        <p className="ttt-history-empty">No moves yet.</p>
                    ) : (
                        <ol className="ttt-history-list">
                            <li className="history-item history-item-start">Game start</li>
                            {history.map(renderHistoryItem)}
                        </ol>
                    )}
                </aside>
            </div>
        </main>
    )
}
