import { type Move } from './ticTacToeLogic'

type MoveHistoryProps = {
    history: Move[]
}

export default function MoveHistory({ history }: MoveHistoryProps) {
    function renderHistoryItem(move: Move, index: number) {
        const moveNumber = index + 1
        const position = move.cellIndex + 1
        const isLatest = index === history.length - 1

        return (
            <li key={index} className={`history-item${isLatest ? ' history-item-latest' : ''}`}>
                Move #{moveNumber} - {move.player} -&gt; pos {position}
            </li>
        )
    }

    return (
        <aside className="ttt-history">
            <h2 className="ttt-history-title">Move history</h2>
            {history.length === 0 ? (
                <p className="ttt-history-empty">No moves yet.</p>
            ) : (
                <ol className="ttt-history-list">
                    <li className="history-item history-item-start">Game start</li>
                    {history.map(renderHistoryItem)}
                </ol>
            )}
        </aside>
    )
}
