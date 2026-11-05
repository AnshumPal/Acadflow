import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/download', () => ({ saveBlob: vi.fn() }))

import { saveBlob } from '../utils/download'
import { api, setAuthTokenProvider } from './http'
import { exportExcel, generateTimetable, rescheduleDynamic, scheduleExtra } from './timetable'
import { getErrorMessage } from './errors'
import { TIMEOUTS } from './config'
import { bodyOf, mockAdapter } from '../test/mockAdapter'

const ok = (data) => () => ({ data })

describe('timetable API service', () => {
  afterEach(() => {
    setAuthTokenProvider(null)
    vi.mocked(saveBlob).mockClear()
  })

  it('posts the payload to /api/v1/generate with the longer solver timeout', async () => {
    const calls = mockAdapter(api, ok({ status: 'success', schedule: { A: [] }, message: 'done' }))
    const data = await generateTimetable({ num_days: 5, sections: ['A'] })

    expect(data).toEqual({ status: 'success', schedule: { A: [] }, message: 'done' })
    expect(calls[0].method).toBe('post')
    expect(calls[0].url).toBe('/api/v1/generate')
    expect(calls[0].timeout).toBe(TIMEOUTS.generate)
    expect(bodyOf(calls[0])).toEqual({ num_days: 5, sections: ['A'] })
  })

  it('uses a same-origin base URL by default so the Vite proxy handles /api', () => {
    expect(api.defaults.baseURL).toBe('')
    expect(api.defaults.timeout).toBe(TIMEOUTS.default)
  })

  it('sends reschedule and extra-class bodies unchanged, including fields the backend may ignore', async () => {
    const calls = mockAdapter(api, ok({ status: 'success', schedule: {}, message: 'ok' }))
    const body = { current_schedule: {}, target_day: 2, course: { id: 'C1' }, all_rooms: ['R1'], num_periods: 8, num_days: 6, target_period: 5 }

    await rescheduleDynamic(body)
    await scheduleExtra({ course_id: 'C1', section: 'A' })

    expect(calls.map((c) => c.url)).toEqual(['/api/v1/reschedule-dynamic', '/api/v1/schedule-extra'])
    expect(bodyOf(calls[0])).toEqual(body)
  })

  it('rejects with the backend detail when no slot is free', async () => {
    mockAdapter(api, () => ({ status: 400, data: { detail: 'No available slots found in matching room types on this day.' } }))
    const err = await rescheduleDynamic({}).catch((e) => e)
    expect(getErrorMessage(err)).toBe('No available slots found in matching room types on this day.')
  })

  it('downloads the Excel export as an .xlsx blob', async () => {
    const calls = mockAdapter(api, ok(new Blob(['PK'])))
    await exportExcel({ schedule: { A: [] }, num_days: 6, num_periods: 8 })

    expect(calls[0].url).toBe('/api/v1/export/excel')
    expect(calls[0].responseType).toBe('blob')
    expect(saveBlob).toHaveBeenCalledTimes(1)
    const [blob, filename] = vi.mocked(saveBlob).mock.calls[0]
    expect(filename).toBe('AcadFlow_Timetable_Formatted.xlsx')
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })

  it('decodes a JSON error body that arrives as a Blob (failed Excel export)', async () => {
    mockAdapter(api, () => ({
      status: 500,
      data: new Blob([JSON.stringify({ detail: 'Failed to generate Excel: boom' })], { type: 'application/json' }),
    }))
    const err = await exportExcel({ schedule: {}, num_days: 6, num_periods: 8 }).catch((e) => e)
    expect(getErrorMessage(err)).toBe('Failed to generate Excel: boom')
    expect(saveBlob).not.toHaveBeenCalled()
  })

  it('adds a Bearer header only once a token provider is registered', async () => {
    const calls = mockAdapter(api, ok({}))
    await scheduleExtra({})
    setAuthTokenProvider(() => 'abc123')
    await scheduleExtra({})

    expect(calls[0].headers.Authorization).toBeUndefined()
    expect(calls[1].headers.Authorization).toBe('Bearer abc123')
  })
})
