import axios from 'axios'

// Dev: same-origin /api → Vite proxy → backend (avoids localhost vs 127.0.0.1 CORS issues)
const BASE_URL =
  import.meta.env.DEV ? '' : 'http://127.0.0.1:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export async function generateTimetable(payload) {
  const { data } = await api.post('/api/v1/generate', payload)
  return data
}

export async function exportExcel({ schedule, num_days, num_periods }) {
  const res = await api.post(
    '/api/v1/export/excel',
    { schedule, num_days, num_periods },
    { responseType: 'blob' },
  )
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'AcadFlow_Timetable_Formatted.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function scheduleExtra(body) {
  const { data } = await api.post('/api/v1/schedule-extra', body)
  return data
}

export async function rescheduleDynamic(body) {
  const { data } = await api.post('/api/v1/reschedule-dynamic', body)
  return data
}

export function getErrorMessage(err) {
  if (err.response?.data?.detail) {
    const d = err.response.data.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      return d.map(item => item.msg || item.message || JSON.stringify(item)).join('; ')
    }
    return JSON.stringify(d)
  }
  return err.message || 'Request failed'
}
