import { Player, type Cell } from "./ticTacToeLogic"

type SquareProps = {
    value: Cell
    isWinning: boolean
    isGameOver: boolean
    onClick: () => void
}

function getClassName(value: Cell, isWinning: boolean) {
    let className = 'square'
    if (value === Player.X) className += ' square-x'
    if (value === Player.O) className += ' square-o'
    if (isWinning) className += ' square-winning'
    return className
}

export default function Square({ value, isWinning, isGameOver, onClick }: SquareProps) {
    return (
        <button
            className={getClassName(value, isWinning)}
            type="button"
            onClick={onClick}
            disabled={value !== null || isGameOver}
        >
            {value != null && <span>{value}</span>}
        </button>
    )
}
