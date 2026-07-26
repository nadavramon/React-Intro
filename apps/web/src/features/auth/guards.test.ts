import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isRedirect } from '@tanstack/react-router'

vi.mock('./authClient', () => ({ authClient: { getSession: vi.fn() } }))

import { authClient } from './authClient'
import { requireSession, redirectIfSignedIn } from './guards'

const getSession = vi.mocked(authClient.getSession)

async function catchRedirect(fn: () => Promise<unknown>) {
    try {
        await fn()
    } catch (err) {
        return err
    }
    return null
}

beforeEach(() => vi.clearAllMocks())

describe('requireSession', () => {
    it('resolves when a session exists', async () => {
        getSession.mockResolvedValueOnce({ data: { user: {} } } as never)
        await expect(requireSession()).resolves.toBeUndefined()
    })

    it('redirects to /login when there is no session', async () => {
        getSession.mockResolvedValueOnce({ data: null } as never)
        const err = await catchRedirect(requireSession)
        expect(isRedirect(err)).toBe(true)
        expect((err as { options: { to: string } }).options.to).toBe('/login')
    })

    it('resolves silently when the auth server is unreachable', async () => {
        getSession.mockRejectedValueOnce(new Error('ECONNREFUSED'))
        await expect(requireSession()).resolves.toBeUndefined()
    })
})

describe('redirectIfSignedIn', () => {
    it('redirects to /tasks when a session exists', async () => {
        getSession.mockResolvedValueOnce({ data: { user: {} } } as never)
        const err = await catchRedirect(redirectIfSignedIn)
        expect(isRedirect(err)).toBe(true)
        expect((err as { options: { to: string } }).options.to).toBe('/tasks')
    })

    it('resolves when there is no session', async () => {
        getSession.mockResolvedValueOnce({ data: null } as never)
        await expect(redirectIfSignedIn()).resolves.toBeUndefined()
    })
})
