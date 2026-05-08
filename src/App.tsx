import { useState } from 'react'
import CounterButton from './CounterButton'

const COUNT = 12
const INTIAL_COUNTERS = createEmptyCounters()

function createEmptyCounters(): number[] {
  return Array(COUNT).fill(0)
}

function sumCounters(counters: number[]): number {
  return counters.reduce((sum, value) => sum + value, 0)
}

function App() {
  const [counters, setCounters] = useState(INTIAL_COUNTERS)

  const total = sumCounters(counters)
  const maxValue = Math.max(...counters)

  function increment(index: number) {
    setCounters((previousCounters) => {
      return previousCounters.map((counterValue, counterIndex) => {
        if (counterIndex === index)
          return counterValue + 1
        else
          return counterValue
      })
    })
  }

  function reset() {
    setCounters(INTIAL_COUNTERS)
  }

  function renderCounter(value: number, index: number) {
    const isMax = value > 0 && value === maxValue

    return (
      <CounterButton
        key={index}
        index={index}
        value={value}
        isMax={isMax}
        onClick={() => increment(index)}
      />
    )
  }

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

      <button className="reset" onClick={reset}>Reset</button>
    </main>
  )
}

export default App
