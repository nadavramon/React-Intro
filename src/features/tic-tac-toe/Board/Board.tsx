import { type Cell } from '../ticTacToeLogic'
import Square from '../Square/Square'

type BoardProps = {
    board: Cell[]
    winningLine: number[] | null
    isGameOver: boolean
    onSquareClick: (index: number) => void
}

export default function Board({ board, winningLine, isGameOver, onSquareClick }: BoardProps) {
    return (
        <div className="grid w-[280px] grid-cols-3 gap-2 sm:w-[360px] md:w-[480px]">
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
