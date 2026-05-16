import { type Cell } from '../ticTacToeLogic'
import Square from '../Square'
import styles from './Board.module.css'

type BoardProps = {
    board: Cell[]
    winningLine: number[] | null
    isGameOver: boolean
    onSquareClick: (index: number) => void
}

export default function Board({ board, winningLine, isGameOver, onSquareClick }: BoardProps) {
    return (
        <div className={styles.board}>
            {board.map((value, i) => (
                <Square
                    key={i}
                    value={value}
                    isWinning={winningLine?.includes(i) ?? false}
                    isGameOver={isGameOver}
                    onClick={() => onSquareClick(i)}
                />
            ))}
        </div>
    )
}
