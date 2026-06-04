import { type Move } from '../ticTacToeLogic'
import { cn } from '@/lib/utils'

type MoveHistoryProps = {
    history: Move[]
}

export default function MoveHistory({ history }: MoveHistoryProps) {
    function renderHistoryItem(move: Move, index: number) {
        const moveNumber = index + 1
        const position = move.cellIndex + 1
        const isLatest = index === history.length - 1

        return (
            <li
                key={index}
                className={cn(
                    'bg-card rounded-md border px-3 py-2 text-sm',
                    isLatest && 'border-primary',
                )}
            >
                Move #{moveNumber} - {move.player} -&gt; pos {position}
            </li>
        )
    }

    return (
        <aside className="flex flex-col gap-3">
            <h2 className="text-foreground text-lg font-semibold">Move history</h2>
            {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No moves yet.</p>
            ) : (
                <ol className="flex list-none flex-col gap-1 p-0">
                    <li className="bg-muted text-muted-foreground rounded-md border px-3 py-2 text-sm">
                        Game start
                    </li>
                    {history.map(renderHistoryItem)}
                </ol>
            )}
        </aside>
    )
}
