// NOTE: lodash.debounce is frozen-but-stable. A future migration could
// swap to es-toolkit's debounce or a hand-rolled setTimeout with no API change.
import { useEffect, useMemo, useState } from 'react'
import debounce from 'lodash.debounce'

export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value)

    // Stable debounced setter — memoized so the SAME timer instance
    // coalesces consecutive calls. Recreated only if delay changes.
    const update = useMemo(() => debounce((next: T) => setDebounced(next), delay), [delay])

    useEffect(() => {
        update(value)
        return () => update.cancel()
    }, [value, update])

    return debounced
}
