import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTodoActions, useTodoStore } from './store/useTodoStore'
import { TodoStatus } from './store/todoStore'
import AddTaskForm from './components/AddTaskForm/AddTaskForm'
import SearchBar from './components/SearchBar/SearchBar'
import TaskStats from './components/TaskStats/TaskStats'
import TaskList from './components/TaskList/TaskList'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export default function TodoPage() {
    const status = useTodoStore((s) => s.status)
    const errorMessage = useTodoStore((s) => s.errorMessage)
    const tasks = useTodoStore((s) => s.tasks)
    const { deleteCompleted } = useTodoActions()

    const [searchQuery, setSearchQuery] = useState('')

    const filteredTasks = useMemo(
        () => tasks.filter((task) => task.title.toLowerCase().includes(searchQuery.toLowerCase())),
        [tasks, searchQuery],
    )

    if (status === TodoStatus.Idle || status === TodoStatus.Loading) {
        return (
            <main className="mx-auto flex min-h-full max-w-2xl items-center justify-center px-6 py-14">
                <div className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    <span>Loading tasks…</span>
                </div>
            </main>
        )
    }

    if (status === TodoStatus.Error) {
        return (
            <main className="mx-auto flex min-h-full max-w-2xl items-center justify-center px-6 py-14">
                <p className="text-destructive">{errorMessage}</p>
            </main>
        )
    }

    async function handleDeleteCompleted() {
        try {
            const count = tasks.filter((t) => t.isCompleted).length
            await deleteCompleted()
            toast.success(`Deleted ${count} task${count === 1 ? '' : 's'}`)
        } catch {
            toast.error('Failed to delete tasks')
        }
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-14">
            <header className="flex flex-col gap-1">
                <h1 className="text-foreground text-3xl font-bold tracking-tight">Todo</h1>
                <p className="text-muted-foreground text-sm">Track your tasks</p>
            </header>
            <AddTaskForm />
            <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />
            <TaskStats />
            <Button
                className="self-start"
                variant="destructive"
                onClick={handleDeleteCompleted}
                disabled={!tasks.some((t) => t.isCompleted)}
            >
                Delete completed
            </Button>
            {filteredTasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    {tasks.length === 0
                        ? 'No tasks yet. Add one above.'
                        : `No tasks match "${searchQuery}".`}
                </p>
            ) : (
                <TaskList tasks={filteredTasks} />
            )}
        </main>
    )
}
