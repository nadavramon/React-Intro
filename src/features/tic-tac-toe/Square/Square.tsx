import { Player, type Cell } from '../ticTacToeLogic'
import clsx from 'clsx'
import styles from './Square.module.css'

type SquareProps = {
    value: Cell
    isWinning: boolean
    isGameOver: boolean
    onClick: () => void
}

export default function Square({ value, isWinning, isGameOver, onClick }: SquareProps) {
    return (
        <button
            className={clsx(
                styles.square,
                value === Player.X && styles.squareX,
                value === Player.O && styles.squareO,
                isWinning && styles.squareWinning,
            )}
            type="button"
            onClick={onClick}
            disabled={value !== null || isGameOver}
        >
            {value != null && <span>{value}</span>}
        </button>
    )
}
