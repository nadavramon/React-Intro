import type { Task } from '@/features/todo/types'
import TaskItem from './TaskItem/TaskItem'

type TaskListProps = {
    tasks: Task[]
    onToggle: (id: string) => void
}

export default function TaskList({ tasks, onToggle }: TaskListProps) {
    return (
        <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskItem key={task.id} task={task} onToggle={onToggle} />
            ))}
        </ul>
    )
}
