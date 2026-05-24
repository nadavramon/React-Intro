import { useState } from 'react'
import { useTasks } from './hooks/useTasks'
import AddTaskForm from './components/AddTaskForm/AddTaskForm'
import SearchBar from './components/SearchBar/SearchBar'
import TaskStats from './components/TaskStats/TaskStats'
import TaskList from './components/TaskList/TaskList'
import styles from './TodoPage.module.css'

export default function TodoPage() {
    const {
        tasks,
        total,
        active,
        completed,
        loading,
        error,
        addTask,
        toggleTask,
        deleteCompleted,
    } = useTasks()
    const [searchQuery, setSearchQuery] = useState('')

    const filteredTasks = tasks.filter((task) =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    if (loading) {
        return (
            <main className={styles.todo}>
                <p className={styles.empty}>Loading tasks...</p>
            </main>
        )
    }

    if (error) {
        return (
            <main className={styles.todo}>
                <p className={styles.empty}>{error}</p>
            </main>
        )
    }

    return (
        <main className={styles.todo}>
            <header className={styles.todoHeader}>
                <h1 className={styles.todoTitle}>Todo</h1>
                <p className={styles.todoSubtitle}>Track your tasks</p>
            </header>
            <AddTaskForm onAdd={addTask} />
            <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />
            <TaskStats total={total} active={active} completed={completed} />
            <button
                className={styles.deleteCompleted}
                type="button"
                onClick={deleteCompleted}
                disabled={completed === 0}
            >
                Delete completed
            </button>
            {filteredTasks.length === 0 ? (
                <p className={styles.empty}>
                    {tasks.length === 0
                        ? 'No tasks yet. Add one above.'
                        : `No tasks match "${searchQuery}".`}
                </p>
            ) : (
                <TaskList tasks={filteredTasks} onToggle={toggleTask} />
            )}
        </main>
    )
}
