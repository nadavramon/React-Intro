import { type Player } from "./ticTacToeLogic";

type StatusBarProps = {
    winner: Player | null
    isDraw: boolean
    currentPlayer: Player
    onRestart: () => void
}

export default function StatusBar({ winner, isDraw, currentPlayer, onRestart }: StatusBarProps) {
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

    return (
        <div className="ttt-statusbar">
            <div className="ttt-status">
                <svg className="ttt-status-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20" aria-hidden="true">
                    <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" clipRule="evenodd" />
                </svg>
                <span className="ttt-status-text">{renderStatus()}</span>
            </div>

            <button className="ttt-restart" type="button" onClick={onRestart}>
                <svg className="ttt-restart-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Restart
            </button>
        </div>
    )

}
