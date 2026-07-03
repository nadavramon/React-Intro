import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { ROUTES } from '@/routes'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/authClient'

type HeaderProps = {
    sidebarOpen: boolean
    onToggleSidebar: () => void
}

export default function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
    const { data: session } = authClient.useSession()

    async function handleSignOut() {
        await authClient.signOut()
        window.location.assign('/login')
    }

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
            {session && (
                <div className="ml-auto flex items-center gap-3">
                    {session.user.image && (
                        <img
                            src={session.user.image}
                            alt=""
                            className="border-foreground size-7 rounded-full border-2"
                        />
                    )}
                    <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                        {session.user.name}
                    </span>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="hover:bg-muted text-foreground focus-visible:ring-primary/60 inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none"
                    >
                        Sign out
                    </button>
                </div>
            )}
        </header>
    )
}
