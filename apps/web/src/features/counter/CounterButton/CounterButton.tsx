import { cn } from '@/lib/utils'

type Props = {
    index: number
    value: number
    isMax: boolean
    onClick: () => void
}

function CounterButton({ index, value, isMax, onClick }: Props) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'relative flex aspect-square cursor-pointer items-center justify-center rounded-xl border p-3.5 font-sans transition duration-200',
                'border-border bg-(--card-bg) text-(--text-h)',
                'hover:-translate-y-px hover:border-(--accent-border)',
                'active:translate-y-0 active:scale-[0.97] active:duration-50',
                'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[3px]',
                isMax &&
                'border-transparent bg-linear-to-br from-accent to-(--accent-2) text-white shadow-counter-glow hover:-translate-y-0.5 hover:border-transparent',
            )}
        >
            <span
                className={cn(
                    'absolute top-3 left-3.5 text-xs tracking-wide text-(--text)',
                    isMax && 'text-white/85',
                )}
            >
                #{index + 1}
            </span>
            <span
                key={value}
                className="animate-pop text-[64px] font-bold tracking-tighter tabular-nums"
            >
                {value}
            </span>
        </button>
    )
}

export default CounterButton
