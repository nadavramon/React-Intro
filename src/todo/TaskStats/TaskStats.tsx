import styles from './TaskStats.module.css'

type TaskStatsProps = {
    total: number
    active: number
    completed: number
}

export default function TaskStats({ total, active, completed }: TaskStatsProps) {
    return (
        <div className={styles.stats}>
            <div className={styles.card}>
                <span className={styles.label}>Total</span>
                <span className={styles.value}>{total}</span>
            </div>
            <div className={styles.card}>
                <span className={styles.label}>Active</span>
                <span className={styles.value}>{active}</span>
            </div>
            <div className={styles.card}>
                <span className={styles.label}>Completed</span>
                <span className={styles.value}>{completed}</span>
            </div>
        </div>
    )
}
