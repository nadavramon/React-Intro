import { useState } from 'react'
import { toast } from 'sonner'
import { ROUTES } from '@/routes'
import { authClient } from '../authClient'
import { Button } from '@/components/ui/button'
import { AuthForm, NETWORK_ERROR, type Mode } from './AuthForm'
import { GoogleIcon } from './GoogleIcon'

export function LoginPage() {
    const [mode, setMode] = useState<Mode>('sign-in')
    const [error, setError] = useState<string | null>(null)
    const isSignUp = mode === 'sign-up'

    function handleErrorChange(message: string | null) {
        setError(message)
        if (message) toast.error(message)
    }

    async function handleGoogle() {
        try {
            const result = await authClient.signIn.social({
                provider: 'google',
                callbackURL: `${window.location.origin}${ROUTES.todo}`,
            })
            if (result?.error) handleErrorChange(result.error.message ?? 'Google sign-in failed')
        } catch {
            handleErrorChange(NETWORK_ERROR)
        }
    }

    return (
        <main className="flex min-h-full items-center justify-center px-6 py-14">
            <div className="border-foreground bg-background shadow-[8px_8px_0_0_var(--color-primary)] relative w-full max-w-sm border-4 p-8">
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
                    className="bg-foreground text-background hover:bg-foreground/85 h-11 w-full gap-3 rounded-none border-2 border-transparent text-xs font-bold tracking-[0.2em] uppercase"
                >
                    <GoogleIcon />
                    Connect via Google
                </Button>

                <div className="text-muted-foreground my-6 flex items-center gap-3 text-[10px] font-bold tracking-[0.3em] uppercase">
                    <span aria-hidden="true" className="bg-border h-0.5 flex-1" />
                    or
                    <span aria-hidden="true" className="bg-border h-0.5 flex-1" />
                </div>

                <AuthForm mode={mode} error={error} onErrorChange={handleErrorChange} />

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
