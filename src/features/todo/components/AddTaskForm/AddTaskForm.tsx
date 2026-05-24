import { useState } from 'react'
import styles from './AddTaskForm.module.css'

type AddTaskFormProps = {
    onAdd: (title: string) => void
}

export default function AddTaskForm({ onAdd }: AddTaskFormProps) {
    const [title, setTitle] = useState('')

    function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        onAdd(title)
        setTitle('')
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <input
                className={styles.input}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="New task"
                placeholder="New task..."
            />
            <button className={styles.button} type="submit" disabled={title.trim() === ''}>
                Add
            </button>
        </form>
    )
}
