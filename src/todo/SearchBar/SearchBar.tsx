import styles from './SearchBar.module.css'

type SearchBarProps = {
    query: string
    onQueryChange: (query: string) => void
}

export default function SearchBar({ query, onQueryChange }: SearchBarProps) {
    return (
        <input
            className={styles.search}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Search tasks"
            placeholder="Search tasks..."
        />
    )
}
