import clsx from 'clsx'
import styles from './CounterButton.module.css'

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
            className={clsx(styles.counterCard, isMax && styles.isMax)}
            onClick={onClick}
        >
            <span className={styles.counterLabel}>#{index + 1}</span>
            <span className={styles.counterValue}>{value}</span>
        </button>
    )
}

export default CounterButton
