import { useState } from 'react'
import CounterApp from './CounterApp'
import TicTacToe from './TicTacToe'

enum View {
  Counter = 'counter',
  TicTacToe = 'tictactoe',
}

export default function App() {
  const [view, setView] = useState<View>(View.TicTacToe)

  const navButtonClass = (buttonView: View) =>
    `nav-button${view === buttonView ? ' is-active' : ''}`

  return (
    <>
      <nav className="nav">
        <button className={navButtonClass(View.Counter)} onClick={() => setView(View.Counter)}>
          Counter
        </button>
        <button className={navButtonClass(View.TicTacToe)} onClick={() => setView(View.TicTacToe)}>
          Tic-Tac-Toe
        </button>
      </nav>

      {view === View.Counter ? <CounterApp /> : <TicTacToe />}
    </>
  )
}