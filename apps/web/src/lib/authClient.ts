import { createAuthClient } from 'better-auth/react'

// Dev: VITE_API_BASE_URL is absolute (http://localhost:3000/api) → new URL keeps it.
// Prod: it's '/api' (same-origin) → resolves against the page origin.
export const authClient = createAuthClient({
    baseURL: new URL(import.meta.env.VITE_API_BASE_URL + '/auth', window.location.origin).href,
})
