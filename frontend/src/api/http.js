import axios from 'axios'
import { API_BASE_URL, TIMEOUTS } from './config'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUTS.default,
  headers: { 'Content-Type': 'application/json' },
})

// Auth hook. The backend has no auth yet; when it does, register a getter that returns the
// current token (or null) and every request will carry it as a Bearer header.
let tokenProvider = null

export function setAuthTokenProvider(getToken) {
  tokenProvider = typeof getToken === 'function' ? getToken : null
}

api.interceptors.request.use((config) => {
  const token = tokenProvider?.()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Error bodies of blob requests (Excel export) arrive as a Blob. Decode them so the
// FastAPI `detail` message is readable by getErrorMessage().
api.interceptors.response.use(undefined, async (error) => {
  const data = error.response?.data
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const text = await data.text()
      try {
        error.response.data = JSON.parse(text)
      } catch {
        error.response.data = text
      }
    } catch {
      // keep the original blob
    }
  }
  return Promise.reject(error)
})
