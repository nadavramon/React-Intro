import { createAuthClient } from 'better-auth/react'

function resolveAuthBaseUrl(apiBaseUrl: string) {
    return new URL(`${apiBaseUrl}/auth`, window.location.origin).href
}

export const authClient = createAuthClient({
    baseURL: resolveAuthBaseUrl(import.meta.env.VITE_API_BASE_URL),
})
