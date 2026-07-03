import { toast } from 'sonner'
import type { Task } from '@/features/todo/types'
import { useToggleTask } from '@/features/todo/store/todoStore'
import TaskItem from './TaskItem/TaskItem'

type TaskListProps = {
    tasks: Task[]
}

export default function TaskList({ tasks }: TaskListProps) {
    const toggleTask = useToggleTask()

    async function handleToggle(id: string) {
        try {
            await toggleTask(id)
        } catch {
            toast.error('Failed to update task')
        }
    }

    return (
        <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskItem key={task.id} task={task} onToggle={() => handleToggle(task.id)} />
            ))}
        </ul>
    )
}
