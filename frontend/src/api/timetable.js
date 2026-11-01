import { api } from './http'
import { TIMEOUTS } from './config'
import { saveBlob } from '../utils/download'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function generateTimetable(payload, config) {
  const { data } = await api.post('/api/v1/generate', payload, { timeout: TIMEOUTS.generate, ...config })
  return data
}

/** Downloads the formatted Excel workbook for `schedule`. */
export async function exportExcel({ schedule, num_days, num_periods }) {
  const res = await api.post(
    '/api/v1/export/excel',
    { schedule, num_days, num_periods },
    { responseType: 'blob', timeout: TIMEOUTS.export },
  )
  saveBlob(new Blob([res.data], { type: XLSX_MIME }), 'AcadFlow_Timetable_Formatted.xlsx')
}

export async function scheduleExtra(body, config) {
  const { data } = await api.post('/api/v1/schedule-extra', body, config)
  return data
}

/**
 * Moves a course to the first free period on `target_day`.
 * Extra fields (`num_days`, `target_period`) are ignored by the current backend (Pydantic drops
 * unknown keys) and take effect once it supports them — see docs/api-contract-academic-tracking.md.
 */
export async function rescheduleDynamic(body, config) {
  const { data } = await api.post('/api/v1/reschedule-dynamic', body, config)
  return data
}
