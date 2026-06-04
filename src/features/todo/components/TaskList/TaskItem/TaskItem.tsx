import type { Task } from '@/features/todo/types'
import { cn } from '@/lib/utils'

type TaskItemProps = {
    task: Task
    onToggle: (id: string) => void
}

export default function TaskItem({ task, onToggle }: TaskItemProps) {
    return (
        <li
            className={cn(
                'bg-card animate-slide-in flex items-center gap-3 rounded-md border px-4 py-3 transition',
                task.isCompleted && 'opacity-60',
            )}
        >
            <input
                type="checkbox"
                className="accent-primary size-4 cursor-pointer"
                checked={task.isCompleted}
                onChange={() => onToggle(task.id)}
                aria-label={task.isCompleted ? 'Mark as not done' : 'Mark as done'}
            />
            <span
                className={cn(
                    'text-foreground flex-1 text-sm',
                    task.isCompleted && 'text-muted-foreground line-through',
                )}
            >
                {task.title}
            </span>
        </li>
    )
}
