import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { parseApiError } from './errors'

describe('parseApiError', () => {
    it('returns the server message from a well-formed axios error body', () => {
        const err = new AxiosError('Request failed', 'ERR', undefined, undefined, {
            data: { error: 'Title is too long' },
        } as never)
        expect(parseApiError(err, 'fallback')).toBe('Title is too long')
    })

    it('returns the fallback for a malformed body', () => {
        const err = new AxiosError('Request failed', 'ERR', undefined, undefined, {
            data: { nope: true },
        } as never)
        expect(parseApiError(err, 'fallback')).toBe('fallback')
    })

    it('returns the fallback for a non-axios error', () => {
        expect(parseApiError(new Error('boom'), 'fallback')).toBe('fallback')
    })
})
