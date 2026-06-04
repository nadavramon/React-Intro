import { Link } from 'react-router-dom'
import { ROUTES } from '@/routes'

export default function NotFoundPage() {
    return (
        <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-14 text-center">
            <h1 className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">404</h1>
            <p className="text-foreground text-lg">That page doesn't exist.</p>
            <Link to={ROUTES.counters} className="text-primary hover:underline">
                Go to Counters
            </Link>
        </main>
    )
}
