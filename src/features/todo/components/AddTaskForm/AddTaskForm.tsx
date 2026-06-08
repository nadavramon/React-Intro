import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAddTask } from '@/features/todo/store/useTodoStore'

export default function AddTaskForm() {
    const addTask = useAddTask()
    const [title, setTitle] = useState('')

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        try {
            await addTask(title)
            setTitle('')
            toast.success('Task added')
        } catch {
            toast.error('Failed to add task')
        }
    }

    return (
        <form className="flex gap-2" onSubmit={handleSubmit}>
            <input
                className="bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/30 flex-1 rounded-md border px-3 py-2 text-sm outline-none transition focus-visible:ring-2"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="New task"
                placeholder="New task..."
            />
            <Button type="submit" disabled={title.trim() === ''}>
                Add
            </Button>
        </form>
    )
}
