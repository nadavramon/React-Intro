import { useTodoStore } from '@/features/todo/store/useTodoStore'

const STAT_CARD = 'bg-card flex flex-1 flex-col items-center gap-1 rounded-md border p-4'

export default function TaskStats() {
    const total = useTodoStore((s) => s.tasks.length)
    const completed = useTodoStore((s) => s.tasks.filter((t) => t.isCompleted).length)
    const active = total - completed

    return (
        <div className="flex gap-3">
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs tracking-wide uppercase">Total</span>
                <span className="text-foreground text-2xl font-bold tabular-nums">{total}</span>
            </div>
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs tracking-wide uppercase">
                    Active
                </span>
                <span className="text-foreground text-2xl font-bold tabular-nums">{active}</span>
            </div>
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs tracking-wide uppercase">
                    Completed
                </span>
                <span className="text-primary text-2xl font-bold tabular-nums">{completed}</span>
            </div>
        </div>
    )
}
