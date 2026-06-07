import { toast } from 'sonner'
import type { Task } from '@/features/todo/types'
import { useTodoActions } from '@/features/todo/store/useTodoStore'
import TaskItem from './TaskItem/TaskItem'

type TaskListProps = {
    tasks: Task[]
}

export default function TaskList({ tasks }: TaskListProps) {
    const { toggleTask } = useTodoActions()

    async function handleToggle(id: string, willBeCompleted: boolean) {
        try {
            await toggleTask(id)
            toast.success(willBeCompleted ? 'Task completed' : 'Task marked active')
        } catch {
            toast.error('Failed to update task')
        }
    }

    return (
        <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggle(task.id, !task.isCompleted)}
                />
            ))}
        </ul>
    )
}
