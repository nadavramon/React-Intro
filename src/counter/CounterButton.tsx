import './CounterButton.css'

type Props = {
    index: number
    value: number
    isMax: boolean
    onClick: () => void
}

function CounterButton({ index, value, isMax, onClick }: Props) {
    return (
        <button type="button" className={`counter-card${isMax ? ' is-max' : ''}`} onClick={onClick}>
            <span className="counter-label">#{index + 1}</span>
            <span className="counter-value">{value}</span>
        </button>
    )
}

export default CounterButton
