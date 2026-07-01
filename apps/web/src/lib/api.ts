import axios from 'axios'
import type { AuthTokens } from '@repo/shared'

const TOKEN_KEY = 'authToken'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
})

export async function login() {
    const { data } = await api.post<AuthTokens>('/auth/login', {
        email: import.meta.env.VITE_DEV_EMAIL,
        password: import.meta.env.VITE_DEV_PASSWORD,
    })
    localStorage.setItem(TOKEN_KEY, data.accessToken)
    return data.accessToken
}

const ensureLogin = (() => {
    let pending: Promise<string> | null = null
    return () => {
        if (!pending)
            pending = login().finally(() => {
                pending = null
            })
        return pending
    }
})()

api.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) config.headers.Authorization = `Bearer ${token}`

    return config
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const isLoginRequest = error.config?.url === '/auth/login'
        const alreadyRetried = error.config?._retry
        if (error.response?.status === 401 && !isLoginRequest && !alreadyRetried) {
            error.config._retry = true
            await ensureLogin()
            return api.request(error.config)
        }
        return Promise.reject(error)
    },
)
