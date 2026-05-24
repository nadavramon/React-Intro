import { Player } from '../ticTacToeLogic'
import { Zap, RefreshCcw } from 'lucide-react'
import clsx from 'clsx'
import styles from './StatusBar.module.css'

type StatusBarProps = {
    winner: Player | null
    isDraw: boolean
    currentPlayer: Player
    onRestart: () => void
}

const PLAYER_CLASS: Record<Player, string> = {
    [Player.X]: styles.statusPlayerX,
    [Player.O]: styles.statusPlayerO,
}

export default function StatusBar({ winner, isDraw, currentPlayer, onRestart }: StatusBarProps) {
    function renderStatus() {
        if (winner !== null) {
            return (
                <>
                    Winner:{' '}
                    <span className={clsx(styles.statusPlayer, PLAYER_CLASS[winner])}>
                        {winner}
                    </span>
                </>
            )
        }
        if (isDraw) return <>Draw!</>
        return (
            <>
                Turn:{' '}
                <span className={clsx(styles.statusPlayer, PLAYER_CLASS[currentPlayer])}>
                    {currentPlayer}
                </span>
            </>
        )
    }

    return (
        <div className={styles.statusbar}>
            <div className={styles.status}>
                <Zap className={styles.statusIcon} size={20} aria-hidden="true" />
                <span>{renderStatus()}</span>
            </div>

            <button className={styles.restart} type="button" onClick={onRestart}>
                <RefreshCcw className={styles.restartIcon} size={16} aria-hidden="true" />
                Restart
            </button>
        </div>
    )
}
