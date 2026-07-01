import { Player } from '../ticTacToeLogic'
import { Button } from '@/components/ui/button'
import { Zap, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatusBarProps = {
    winner: Player | null
    isDraw: boolean
    currentPlayer: Player
    onRestart: () => void
}

export default function StatusBar({ winner, isDraw, currentPlayer, onRestart }: StatusBarProps) {
    function renderPlayerBadge(player: Player) {
        return (
            <span
                className={cn(
                    'font-bold',
                    player === Player.X ? 'text-primary' : 'text-secondary',
                )}
            >
                {player}
            </span>
        )
    }

    function renderStatus() {
        if (winner !== null) return <>Winner: {renderPlayerBadge(winner)}</>
        if (isDraw) return <>Draw!</>
        return <>Turn: {renderPlayerBadge(currentPlayer)}</>
    }

    return (
        <div className="bg-card flex items-center justify-between rounded-lg border p-4">
            <div className="text-foreground flex items-center gap-2">
                <Zap className="text-primary" size={20} aria-hidden="true" />
                <span>{renderStatus()}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={onRestart}>
                <RefreshCcw size={16} aria-hidden="true" />
                Restart
            </Button>
        </div>
    )
}
