import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CounterApp from './CounterApp'

// Grabs counter button "#1" (its label span lives inside the <button>).
const firstCounter = () => screen.getByText('#1').closest('button')!
// The total is identified by a stable test id.
const totalValue = () => screen.getByTestId('total-value')

describe('CounterApp', () => {
    it('starts every counter and the total at zero', () => {
        render(<CounterApp />)

        expect(totalValue()).toHaveTextContent('0')
        expect(within(firstCounter()).getByText('0')).toBeInTheDocument()
    })

    it('increments only the clicked counter and updates the total', async () => {
        const user = userEvent.setup()
        render(<CounterApp />)

        await user.click(firstCounter())
        await user.click(firstCounter())

        // The clicked counter shows 2...
        expect(within(firstCounter()).getByText('2')).toBeInTheDocument()
        // ...and the total reflects it.
        expect(totalValue()).toHaveTextContent('2')
    })

    it('resets all counters back to zero', async () => {
        const user = userEvent.setup()
        render(<CounterApp />)

        await user.click(firstCounter())
        expect(totalValue()).toHaveTextContent('1')

        await user.click(screen.getByRole('button', { name: 'Reset' }))
        expect(totalValue()).toHaveTextContent('0')
    })
})
