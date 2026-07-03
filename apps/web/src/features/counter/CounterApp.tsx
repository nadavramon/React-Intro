import { useState } from 'react'
import CounterButton from './CounterButton/CounterButton'
import { Button } from '@/components/ui/button'

const COUNT = 12
const INITIAL_COUNTERS: number[] = Array(COUNT).fill(0)

const sumCounters = (counters: number[]) => counters.reduce((s, v) => s + v, 0)

export default function CounterApp() {
    const [counters, setCounters] = useState(INITIAL_COUNTERS)

    const total = sumCounters(counters)
    const maxValue = Math.max(...counters)

    const increment = (index: number) =>
        setCounters((prev) => prev.map((v, i) => (i === index ? v + 1 : v)))

    return (
        <main className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-14">
            <header className="flex flex-col items-center gap-4">
                <h1 className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
                    Click Counters
                </h1>
                <div className="bg-card flex items-center gap-4 rounded-lg border px-6 py-3">
                    <span className="text-muted-foreground text-sm">Total</span>
                    <span
                        key={total}
                        data-testid="total-value"
                        className="from-primary to-secondary animate-pop bg-linear-to-br bg-clip-text text-4xl font-bold tracking-tight tabular-nums text-transparent"
                    >
                        {total}
                    </span>
                </div>
            </header>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {counters.map((value, index) => (
                    <CounterButton
                        key={index}
                        index={index}
                        value={value}
                        isMax={value > 0 && value === maxValue}
                        onClick={() => increment(index)}
                    />
                ))}
            </div>
            <Button variant="outline" onClick={() => setCounters(INITIAL_COUNTERS)}>
                Reset
            </Button>
        </main>
    )
}
