import { type Move } from '../ticTacToeLogic'
import clsx from 'clsx'
import styles from './MoveHistory.module.css'

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
                className={clsx(styles.historyItem, isLatest && styles.historyItemLatest)}
            >
                Move #{moveNumber} - {move.player} -&gt; pos {position}
            </li>
        )
    }

    return (
        <aside className={styles.history}>
            <h2 className={styles.historyTitle}>Move history</h2>
            {history.length === 0 ? (
                <p className={styles.historyEmpty}>No moves yet.</p>
            ) : (
                <ol className={styles.historyList}>
                    <li className={clsx(styles.historyItem, styles.historyItemStart)}>
                        Game start
                    </li>
                    {history.map(renderHistoryItem)}
                </ol>
            )}
        </aside>
    )
}
