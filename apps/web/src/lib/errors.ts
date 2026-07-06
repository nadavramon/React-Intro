import { isAxiosError } from 'axios'
import { errorResponseSchema } from '@repo/shared'

// Safely pull the server's error message off a failed request, falling back to
// a friendly message for network errors / opaque bodies / non-axios throws.
export function parseApiError(err: unknown, fallback: string): string {
    if (isAxiosError(err)) {
        const parsed = errorResponseSchema.safeParse(err.response?.data)
        if (parsed.success) return parsed.data.error
    }
    return fallback
}
