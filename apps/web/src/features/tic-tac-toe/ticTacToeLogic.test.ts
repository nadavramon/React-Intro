import { describe, it, expect } from 'vitest'
import { Player, findWinner, isBoardFull, BOARD_SIZE, type Cell } from './ticTacToeLogic'

// A fresh, empty board: 9 null cells.
const emptyBoard = (): Cell[] => Array<Cell>(BOARD_SIZE).fill(null)

describe('findWinner', () => {
    it('returns null on an empty board', () => {
        expect(findWinner(emptyBoard())).toBeNull()
    })

    it('detects a winning row and reports the line', () => {
        const board = emptyBoard()
        board[0] = board[1] = board[2] = Player.X

        expect(findWinner(board)).toEqual({ winner: Player.X, line: [0, 1, 2] })
    })

    it('detects a winning diagonal', () => {
        const board = emptyBoard()
        board[0] = board[4] = board[8] = Player.O

        expect(findWinner(board)).toEqual({ winner: Player.O, line: [0, 4, 8] })
    })

    it('does not call a near-miss a win', () => {
        const board = emptyBoard()
        board[0] = Player.X
        board[1] = Player.X
        board[2] = Player.O // row blocked

        expect(findWinner(board)).toBeNull()
    })
})

describe('isBoardFull', () => {
    it('is false while empty cells remain', () => {
        expect(isBoardFull(emptyBoard())).toBe(false)
    })

    it('is true once every cell is filled', () => {
        expect(isBoardFull(Array<Cell>(BOARD_SIZE).fill(Player.X))).toBe(true)
    })
})
