import { Link } from 'react-router-dom'

export default function NotFoundPage() {
    return (
        <main className="app">
            <header className="header">
                <h1 className="title">404</h1>
            </header>
            <p>That page doesn't exist.</p>
            <Link to="/counters">Go to Counters</Link>
        </main>
    )
}
