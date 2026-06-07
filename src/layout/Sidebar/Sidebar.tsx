import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/routes'
import { cn } from '@/lib/utils'
import { useTodoStore } from '@/features/todo'

type SidebarProps = {
    isOpen: boolean
}

const NAV_ITEMS = [
    { to: ROUTES.counters, label: 'Counters' },
    { to: ROUTES.ticTacToe, label: 'Tic-Tac-Toe' },
    { to: ROUTES.todo, label: 'Todo' },
] as const

export default function Sidebar({ isOpen }: SidebarProps) {
    const activeCount = useTodoStore((s) => s.tasks.filter((t) => !t.isCompleted).length)

    return (
        <aside
            className={cn(
                'bg-sidebar text-sidebar-foreground overflow-hidden border-r transition-[width] duration-300 ease-out',
                isOpen ? 'w-60' : 'w-0 border-r-0',
            )}
            aria-hidden={!isOpen}
        >
            <div className="flex w-60 flex-col gap-6 p-4">
                <h2 className="text-primary px-2 text-xs font-semibold tracking-[0.2em] uppercase">
                    React Intro
                </h2>
                <nav className="flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-sidebar-accent text-foreground'
                                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
                                )
                            }
                        >
                            <span className="flex-1">{item.label}</span>
                            {item.to === ROUTES.todo && activeCount > 0 && (
                                <span
                                    key={activeCount}
                                    aria-label={`${activeCount} active tasks`}
                                    className="bg-primary text-primary-foreground animate-pop inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                                >
                                    {activeCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>
        </aside>
    )
}
