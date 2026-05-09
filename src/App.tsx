import { useState } from 'react'
import CounterButton from './CounterButton'

const COUNT = 12
const INITIAL_COUNTERS: number[] = Array(COUNT).fill(0)

const sumCounters = (counters: number[]) => counters.reduce((s, v) => s + v, 0)

export default function App() {
  const [counters, setCounters] = useState(INITIAL_COUNTERS)

  const total = sumCounters(counters)
  const maxValue = Math.max(...counters)

  const increment = (index: number) => setCounters(prev => prev.map((v, i) => i === index ? v + 1 : v))

  const renderCounter = (value: number, index: number) => (
    <CounterButton
      key={index}
      index={index}
      value={value}
      isMax={value > 0 && value === maxValue}
      onClick={() => increment(index)}
    />
  )

  return (
    <main className="app">
      <header className="header">
        <h1 className="title">Click Counters</h1>
        <div className="total-pill">
          <span className="total-label">Total</span>
          <span className="total-value">{total}</span>
        </div>
      </header>

      <div className="grid">
        {counters.map(renderCounter)}
      </div>

      <button className="reset" onClick={() => setCounters(INITIAL_COUNTERS)}>Reset</button>
    </main>
  )
}
