import { useState } from 'react'
import styles from './AddTaskForm.module.css'

type AddTaskFormProps = {
    onAdd: (text: string) => void
}

export default function AddTaskForm({ onAdd }: AddTaskFormProps) {
    const [text, setText] = useState('')

    function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        onAdd(text)
        setText('')
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <input
                className={styles.input}
                type="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                aria-label="New task"
                placeholder="New task..."
            />
            <button className={styles.button} type="submit" disabled={text.trim() === ''}>
                Add
            </button>
        </form>
    )
}
