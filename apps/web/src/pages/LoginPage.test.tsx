import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/authClient', () => ({
    authClient: {
        signIn: { social: vi.fn(), email: vi.fn().mockResolvedValue({ data: {}, error: null }) },
        signUp: { email: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    },
}))

import { authClient } from '@/lib/authClient'
import LoginPage from './LoginPage'

beforeEach(() => vi.clearAllMocks())

describe('LoginPage', () => {
    it('starts the Google flow with an absolute callbackURL', async () => {
        render(<LoginPage />)
        await userEvent.click(screen.getByRole('button', { name: /connect via google/i }))
        expect(authClient.signIn.social).toHaveBeenCalledWith({
            provider: 'google',
            callbackURL: `${window.location.origin}/tasks`,
        })
    })

    it('surfaces a Google sign-in error instead of dropping it', async () => {
        vi.mocked(authClient.signIn.social).mockResolvedValueOnce({
            data: null,
            error: { message: 'Provider not configured' },
        } as never)
        render(<LoginPage />)
        await userEvent.click(screen.getByRole('button', { name: /connect via google/i }))
        expect(await screen.findByRole('alert')).toHaveTextContent(/provider not configured/i)
    })

    it('signs in with email/password', async () => {
        render(<LoginPage />)
        await userEvent.type(screen.getByLabelText(/email/i), 'a@b.c')
        await userEvent.type(screen.getByLabelText(/password/i), 'hunter22')
        await userEvent.click(screen.getByRole('button', { name: /sign in$/i }))
        expect(authClient.signIn.email).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'a@b.c', password: 'hunter22' }),
        )
    })

    it('sign-up mode adds the required name field', async () => {
        render(<LoginPage />)
        await userEvent.click(screen.getByRole('button', { name: /need an account/i }))
        await userEvent.type(screen.getByLabelText(/name/i), 'Nadav')
        await userEvent.type(screen.getByLabelText(/email/i), 'a@b.c')
        await userEvent.type(screen.getByLabelText(/password/i), 'hunter22')
        await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
        expect(authClient.signUp.email).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Nadav', email: 'a@b.c', password: 'hunter22' }),
        )
    })
})
