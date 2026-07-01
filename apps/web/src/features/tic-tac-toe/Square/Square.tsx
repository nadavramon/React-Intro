import { Player, type Cell } from '../ticTacToeLogic'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SquareProps = {
    value: Cell
    isWinning: boolean
    isGameOver: boolean
    onClick: () => void
}

export default function Square({ value, isWinning, isGameOver, onClick }: SquareProps) {
    return (
        <Button
            variant="outline"
            onClick={onClick}
            disabled={value !== null || isGameOver}
            className={cn(
                'aspect-square h-auto w-full text-5xl font-bold disabled:opacity-100',
                value !== null && !isWinning && 'animate-scale-in',
                value === Player.X && 'text-primary',
                value === Player.O && 'text-secondary',
                isWinning && 'border-2 border-primary animate-pulse-once dark:border-primary',
            )}
        >
            {value}
        </Button>
    )
}
