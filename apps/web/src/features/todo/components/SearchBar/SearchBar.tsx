import { Search } from 'lucide-react'

type SearchBarProps = {
    query: string
    onQueryChange: (query: string) => void
}

export default function SearchBar({ query, onQueryChange }: SearchBarProps) {
    return (
        <div className="bg-card focus-within:border-primary focus-within:ring-primary/30 flex items-center gap-2 rounded-md border px-3 py-2 transition focus-within:ring-2">
            <Search className="text-muted-foreground size-4" aria-hidden="true" />
            <input
                className="placeholder:text-muted-foreground text-foreground flex-1 bg-transparent text-sm outline-none"
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
            />
        </div>
    )
}
