import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/features/todo/types'
import { createTodoStore, TodoStatus } from './todoStore'

// Hoisted by Vitest above all imports — replaces the tasks API with stubs.
vi.mock('@/features/todo/api/tasksApi', () => ({
    fetchTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
}))

// Import after the mock so vi.mocked() typing works against the stubs.
import { createTask, deleteTask, fetchTasks, updateTask } from '@/features/todo/api/tasksApi'

const mockedFetch = vi.mocked(fetchTasks)
const mockedCreate = vi.mocked(createTask)
const mockedUpdate = vi.mocked(updateTask)
const mockedDelete = vi.mocked(deleteTask)

const TASK_A: Task = { id: 'a', title: 'A', isCompleted: false }
const TASK_B: Task = { id: 'b', title: 'B', isCompleted: true }

beforeEach(() => {
    vi.clearAllMocks()
})

describe('todoStore', () => {
    describe('init()', () => {
        it('starts in idle status with no tasks', () => {
            const store = createTodoStore()
            expect(store.getState().status).toBe(TodoStatus.Idle)
            expect(store.getState().tasks).toEqual([])
        })

        it('transitions idle → loading → ready on success', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            const store = createTodoStore()

            const promise = store.getState().init()
            expect(store.getState().status).toBe(TodoStatus.Loading)

            await promise
            expect(store.getState().status).toBe(TodoStatus.Ready)
            expect(store.getState().tasks).toEqual([TASK_A, TASK_B])
            expect(store.getState().errorMessage).toBeNull()
        })

        it('transitions idle → loading → error on failure', async () => {
            mockedFetch.mockRejectedValueOnce(new Error('boom'))
            const store = createTodoStore()

            await store.getState().init()
            expect(store.getState().status).toBe(TodoStatus.Error)
            expect(store.getState().errorMessage).toBe('Could not load tasks. Please try again.')
        })

        it('is idempotent — second call against non-idle store is a no-op', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A])
            const store = createTodoStore()

            await store.getState().init()
            await store.getState().init()

            expect(mockedFetch).toHaveBeenCalledTimes(1)
        })
    })

    describe('addTask()', () => {
        it('appends the server-returned task to state', async () => {
            mockedCreate.mockResolvedValueOnce(TASK_A)
            const store = createTodoStore()

            await store.getState().addTask('A')

            expect(store.getState().tasks).toEqual([TASK_A])
            expect(mockedCreate).toHaveBeenCalledWith('A')
        })

        it('trims whitespace before calling the server', async () => {
            mockedCreate.mockResolvedValueOnce(TASK_A)
            const store = createTodoStore()

            await store.getState().addTask('  A  ')

            expect(mockedCreate).toHaveBeenCalledWith('A')
        })

        it('is a no-op for whitespace-only titles', async () => {
            const store = createTodoStore()

            await store.getState().addTask('   ')

            expect(mockedCreate).not.toHaveBeenCalled()
            expect(store.getState().tasks).toEqual([])
        })
    })

    describe('toggleTask()', () => {
        it('flips isCompleted on the targeted task only', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedUpdate.mockResolvedValueOnce({ ...TASK_A, isCompleted: true })

            const store = createTodoStore()
            await store.getState().init()

            await store.getState().toggleTask('a')

            expect(mockedUpdate).toHaveBeenCalledWith('a', { isCompleted: true })
            expect(store.getState().tasks[0]).toEqual({ ...TASK_A, isCompleted: true })
            expect(store.getState().tasks[1]).toEqual(TASK_B)
        })

        it('is a no-op when the id is not found', async () => {
            const store = createTodoStore()
            await store.getState().toggleTask('nonexistent')
            expect(mockedUpdate).not.toHaveBeenCalled()
        })
    })

    describe('deleteTask()', () => {
        it('removes the task and calls the server', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedDelete.mockResolvedValueOnce(undefined)

            const store = createTodoStore()
            await store.getState().init()
            await store.getState().deleteTask('a')

            expect(mockedDelete).toHaveBeenCalledWith('a')
            expect(store.getState().tasks).toEqual([TASK_B])
        })
    })

    describe('deleteCompleted()', () => {
        it('removes all completed tasks in a single batch', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedDelete.mockResolvedValue(undefined)

            const store = createTodoStore()
            await store.getState().init()
            await store.getState().deleteCompleted()

            expect(mockedDelete).toHaveBeenCalledTimes(1)
            expect(mockedDelete).toHaveBeenCalledWith('b')
            expect(store.getState().tasks).toEqual([TASK_A])
        })
    })
})
