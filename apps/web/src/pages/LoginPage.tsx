import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/authClient'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Mode = 'sign-in' | 'sign-up'

const inputClasses = cn(
    'bg-background text-foreground w-full border-2 border-foreground px-3 py-2 text-sm',
    'placeholder:text-muted-foreground focus-visible:outline-none',
    'focus-visible:ring-3 focus-visible:ring-primary/60 focus-visible:border-primary',
)

const labelClasses = 'text-foreground text-xs font-bold tracking-[0.15em] uppercase'

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>('sign-in')
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const isSignUp = mode === 'sign-up'

    function handleGoogle() {
        void authClient.signIn.social({
            provider: 'google',
            callbackURL: `${window.location.origin}/tasks`,
        })
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        setPending(true)
        const form = new FormData(e.currentTarget)
        const email = String(form.get('email') ?? '')
        const password = String(form.get('password') ?? '')
        try {
            const result = isSignUp
                ? await authClient.signUp.email({
                      name: String(form.get('name') ?? ''),
                      email,
                      password,
                  })
                : await authClient.signIn.email({ email, password })
            if (result.error) {
                const message = result.error.message ?? 'Something went wrong. Try again.'
                setError(message)
                toast.error(message)
                return
            }
            // Full reload so the root guard re-fetches the session.
            window.location.assign('/tasks')
        } finally {
            setPending(false)
        }
    }

    return (
        <main className="flex min-h-full items-center justify-center px-6 py-14">
            <div className="border-foreground bg-background shadow-[8px_8px_0_0_var(--color-primary)] relative w-full max-w-sm border-4 p-8">
                {/* Scanline overlay — pure decoration */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-[0.06] [background:repeating-linear-gradient(0deg,transparent,transparent_3px,var(--color-foreground)_3px,var(--color-foreground)_4px)]"
                />

                <header className="mb-8 text-center">
                    <p className="text-primary text-xs font-bold tracking-[0.35em] uppercase">
                        Player 1
                    </p>
                    <h1 className="text-foreground mt-2 text-3xl font-black tracking-[0.1em] uppercase">
                        {isSignUp ? 'New game' : 'Continue?'}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        <span aria-hidden="true" className="text-primary motion-safe:animate-pulse">
                            ▶{' '}
                        </span>
                        {isSignUp ? 'Create your save file' : 'Insert credentials to resume'}
                    </p>
                </header>

                <Button
                    type="button"
                    onClick={handleGoogle}
                    className="bg-foreground text-background hover:bg-foreground/85 h-11 w-full rounded-none border-2 border-transparent text-xs font-bold tracking-[0.2em] uppercase"
                >
                    Connect via Google
                </Button>

                <div className="text-muted-foreground my-6 flex items-center gap-3 text-[10px] font-bold tracking-[0.3em] uppercase">
                    <span aria-hidden="true" className="bg-border h-0.5 flex-1" />
                    or
                    <span aria-hidden="true" className="bg-border h-0.5 flex-1" />
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {isSignUp && (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="login-name" className={labelClasses}>
                                Name
                            </label>
                            <input
                                id="login-name"
                                name="name"
                                type="text"
                                required
                                autoComplete="name"
                                className={inputClasses}
                            />
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-email" className={labelClasses}>
                            Email
                        </label>
                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            className={inputClasses}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-password" className={labelClasses}>
                            Password
                        </label>
                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            required
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            className={inputClasses}
                        />
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="border-destructive text-destructive border-2 px-3 py-2 text-sm font-semibold"
                        >
                            Game over: {error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        disabled={pending}
                        className="bg-primary text-primary-foreground hover:bg-primary/85 h-11 w-full rounded-none border-2 border-foreground text-xs font-bold tracking-[0.2em] uppercase shadow-[3px_3px_0_0_var(--color-foreground)] active:shadow-none"
                    >
                        {isSignUp ? 'Sign up' : 'Sign in'}
                    </Button>
                </form>

                <button
                    type="button"
                    onClick={() => {
                        setMode(isSignUp ? 'sign-in' : 'sign-up')
                        setError(null)
                    }}
                    className="text-muted-foreground hover:text-primary focus-visible:ring-primary/60 mt-6 w-full text-center text-xs font-semibold tracking-[0.1em] uppercase underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:outline-none"
                >
                    {isSignUp ? 'Already a player? Sign in' : 'Need an account? Sign up'}
                </button>
            </div>
        </main>
    )
}
