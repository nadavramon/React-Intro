import type { Task } from '../../types'
import TaskItem from './TaskItem/TaskItem'
import styles from './TaskList.module.css'

type TaskListProps = {
    tasks: Task[]
    onToggle: (id: string) => void
}

export default function TaskList({ tasks, onToggle }: TaskListProps) {
    return (
        <ul className={styles.list}>
            {tasks.map((task) => (
                <TaskItem key={task.id} task={task} onToggle={onToggle} />
            ))}
        </ul>
    )
}
