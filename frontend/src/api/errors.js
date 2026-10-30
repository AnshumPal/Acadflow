import axios from 'axios'

// Pydantic validation item → "current_schedule.A.0.day: Input should be a valid integer"
function formatValidationItem(item) {
  if (!item || typeof item !== 'object') return String(item)
  const loc = Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body').join('.') : ''
  const msg = item.msg || item.message || JSON.stringify(item)
  return loc ? `${loc}: ${msg}` : msg
}

/** Turns any error thrown by the API layer into a single human-readable sentence. */
export function getErrorMessage(err) {
  if (!err) return 'Request failed'
  if (axios.isCancel(err)) return 'Request was cancelled.'
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return 'The server took too long to respond. Please try again.'
  }

  const res = err.response
  if (!res) {
    // axios sets `request` when nothing came back (backend down, proxy error, CORS).
    if (err.request) return 'Cannot reach the AcadFlow server. Make sure the backend is running on port 8000.'
    return err.message || 'Request failed'
  }

  const data = res.data
  const detail = data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(formatValidationItem).join('; ')
  if (detail) return JSON.stringify(detail)

  const text = typeof data === 'string' ? data.trim().slice(0, 200) : ''
  // An empty 5xx in dev usually means the Vite proxy could not reach the backend at all.
  if (res.status >= 500) return `Server error (${res.status})${text ? `: ${text}` : '. Check that the backend is running, then see its logs.'}`
  return text || err.message || `Request failed (${res.status})`
}
