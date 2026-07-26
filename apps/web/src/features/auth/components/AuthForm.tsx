import { useState, type SubmitEvent } from 'react'
import { ROUTES } from '@/routes'
import { authClient } from '../authClient'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type Mode = 'sign-in' | 'sign-up'

export const NETWORK_ERROR = 'Could not reach the server — check your connection and try again'

const inputClasses = cn(
    'bg-background text-foreground w-full border-2 border-foreground px-3 py-2 text-sm',
    'placeholder:text-muted-foreground focus-visible:outline-none',
    'focus-visible:ring-3 focus-visible:ring-primary/60 focus-visible:border-primary',
)

const labelClasses = 'text-foreground text-xs font-bold tracking-[0.15em] uppercase'

export function AuthForm({
    mode,
    error,
    onErrorChange,
}: {
    mode: Mode
    error: string | null
    onErrorChange: (message: string | null) => void
}) {
    const [pending, setPending] = useState(false)
    const isSignUp = mode === 'sign-up'

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        onErrorChange(null)
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
                onErrorChange(result.error.message ?? 'Something went wrong. Try again.')
                return
            }
            window.location.assign(ROUTES.todo)
        } catch {
            onErrorChange(NETWORK_ERROR)
        } finally {
            setPending(false)
        }
    }

    return (
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
    )
}
