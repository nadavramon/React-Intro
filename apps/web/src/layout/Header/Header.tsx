import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { ROUTES } from '@/routes'
import { cn } from '@/lib/utils'

type HeaderProps = {
    sidebarOpen: boolean
    onToggleSidebar: () => void
}

export default function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
    return (
        <header className="bg-card flex h-14 items-center gap-4 border-b px-4 md:px-6">
            <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={sidebarOpen}
                className="hover:bg-muted text-foreground -ml-2 inline-flex size-9 items-center justify-center rounded-md transition-colors"
            >
                <Menu
                    className={cn(
                        'size-5 transition-transform duration-300 ease-out',
                        sidebarOpen && 'rotate-90',
                    )}
                />
            </button>
            <Link to={ROUTES.counters} className="text-foreground text-sm font-semibold">
                React Intro
            </Link>
        </header>
    )
}
