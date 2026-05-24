import clsx from 'clsx'
import type { Task } from '../../../types'
import styles from './TaskItem.module.css'

type TaskItemProps = {
    task: Task
    onToggle: (id: string) => void
}

export default function TaskItem({ task, onToggle }: TaskItemProps) {
    return (
        <li className={clsx(styles.item, task.isCompleted && styles.itemDone)}>
            <label className={styles.label}>
                <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={task.isCompleted}
                    onChange={() => onToggle(task.id)}
                />
                <span className={styles.text}>{task.title}</span>
            </label>
        </li>
    )
}
