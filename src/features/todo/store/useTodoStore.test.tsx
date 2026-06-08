import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTodoStore } from './useTodoStore'

describe('useTodoStore', () => {
    it('throws when called outside <TodoStoreProvider>', () => {
        // React surfaces the throw in renderHook, but also logs to console.error.
        // Silence it so the test output stays clean.
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        expect(() => {
            renderHook(() => useTodoStore((s) => s.tasks))
        }).toThrow('useTodoStore must be used inside <TodoStoreProvider>')

        errorSpy.mockRestore()
    })
})
