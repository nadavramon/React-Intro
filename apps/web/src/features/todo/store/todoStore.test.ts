import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/features/todo/types'
import { TodoStatus, useTodoStore } from './todoStore'

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

// Shallow merge — actions defined inside create() are preserved.
const INITIAL_STATE = {
    tasks: [],
    status: TodoStatus.Idle,
    errorMessage: null,
}

beforeEach(() => {
    useTodoStore.setState(INITIAL_STATE)
    vi.clearAllMocks()
})

describe('todoStore', () => {
    describe('init()', () => {
        it('starts in idle status with no tasks', () => {
            expect(useTodoStore.getState().status).toBe(TodoStatus.Idle)
            expect(useTodoStore.getState().tasks).toEqual([])
        })

        it('transitions idle → loading → ready on success', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])

            const promise = useTodoStore.getState().init()
            expect(useTodoStore.getState().status).toBe(TodoStatus.Loading)

            await promise
            expect(useTodoStore.getState().status).toBe(TodoStatus.Ready)
            expect(useTodoStore.getState().tasks).toEqual([TASK_A, TASK_B])
            expect(useTodoStore.getState().errorMessage).toBeNull()
        })

        it('transitions idle → loading → error on failure', async () => {
            mockedFetch.mockRejectedValueOnce(new Error('boom'))

            await useTodoStore.getState().init()
            expect(useTodoStore.getState().status).toBe(TodoStatus.Error)
            expect(useTodoStore.getState().errorMessage).toBe(
                'Could not load tasks. Please try again.',
            )
        })

        it('is idempotent — second call against non-idle store is a no-op', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A])

            await useTodoStore.getState().init()
            await useTodoStore.getState().init()

            expect(mockedFetch).toHaveBeenCalledTimes(1)
        })
    })

    describe('addTask()', () => {
        it('appends the server-returned task to state', async () => {
            mockedCreate.mockResolvedValueOnce(TASK_A)

            await useTodoStore.getState().addTask('A')

            expect(useTodoStore.getState().tasks).toEqual([TASK_A])
            expect(mockedCreate).toHaveBeenCalledWith('A')
        })

        it('trims whitespace before calling the server', async () => {
            mockedCreate.mockResolvedValueOnce(TASK_A)

            await useTodoStore.getState().addTask('  A  ')

            expect(mockedCreate).toHaveBeenCalledWith('A')
        })

        it('is a no-op for whitespace-only titles', async () => {
            await useTodoStore.getState().addTask('   ')

            expect(mockedCreate).not.toHaveBeenCalled()
            expect(useTodoStore.getState().tasks).toEqual([])
        })
    })

    describe('toggleTask()', () => {
        it('flips isCompleted on the targeted task only', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedUpdate.mockResolvedValueOnce({ ...TASK_A, isCompleted: true })

            await useTodoStore.getState().init()
            await useTodoStore.getState().toggleTask('a')

            expect(mockedUpdate).toHaveBeenCalledWith('a', { isCompleted: true })
            expect(useTodoStore.getState().tasks[0]).toEqual({ ...TASK_A, isCompleted: true })
            expect(useTodoStore.getState().tasks[1]).toEqual(TASK_B)
        })

        it('is a no-op when the id is not found', async () => {
            await useTodoStore.getState().toggleTask('nonexistent')
            expect(mockedUpdate).not.toHaveBeenCalled()
        })
    })

    describe('deleteTask()', () => {
        it('removes the task and calls the server', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedDelete.mockResolvedValueOnce(undefined)

            await useTodoStore.getState().init()
            await useTodoStore.getState().deleteTask('a')

            expect(mockedDelete).toHaveBeenCalledWith('a')
            expect(useTodoStore.getState().tasks).toEqual([TASK_B])
        })
    })

    describe('deleteCompleted()', () => {
        it('removes all completed tasks in a single batch and returns the count', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedDelete.mockResolvedValue(undefined)

            await useTodoStore.getState().init()
            const count = await useTodoStore.getState().deleteCompleted()

            expect(count).toBe(1)
            expect(mockedDelete).toHaveBeenCalledTimes(1)
            expect(mockedDelete).toHaveBeenCalledWith('b')
            expect(useTodoStore.getState().tasks).toEqual([TASK_A])
        })
    })
})
