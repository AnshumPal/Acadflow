import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStorage } from '../test/memoryStorage'
import { bodyOf, mockAdapter } from '../test/mockAdapter'
import { getErrorMessage } from './errors'

const LOGS_KEY = 'acadflow_lectures_v1'

const log = (overrides = {}) => ({
  section: 'V A',
  course_id: 'ML_VA',
  course_name: 'Machine Learning (ML)',
  date: '2026-10-26',
  day: 0,
  period: 2,
  periods: 1,
  room: 'DT-403',
  teachers: ['Dr. A. Pimpalkar'],
  slot_type: 'regular',
  status: 'conducted',
  ...overrides,
})

describe('lecture logs — local data source (default)', () => {
  let lectures

  beforeEach(async () => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    lectures = await import('./lectures')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('creates logs with an id and timestamps, and lists them filtered and sorted', async () => {
    await lectures.createLectureLog(log({ date: '2026-10-27', period: 1 }))
    await lectures.createLectureLog(log({ date: '2026-10-26', period: 5 }))
    await lectures.createLectureLog(log({ date: '2026-10-26', period: 2 }))
    await lectures.createLectureLog(log({ section: 'V B', course_id: 'ML_VB' }))

    const listed = await lectures.listLectureLogs({ section: 'V A' })
    expect(listed.map((l) => `${l.date}/P${l.period}`)).toEqual(['2026-10-26/P2', '2026-10-26/P5', '2026-10-27/P1'])
    expect(listed[0].id).toEqual(expect.any(String))
    expect(listed[0].created_at).toBe(listed[0].updated_at)

    expect(await lectures.listLectureLogs({ section: 'V A', from: '2026-10-27' })).toHaveLength(1)
    expect(await lectures.listLectureLogs({ section: 'V A', status: 'not_held' })).toHaveLength(0)
  })

  it('rejects a second log for the same section, course, date and period', async () => {
    await lectures.createLectureLog(log())
    await expect(lectures.createLectureLog(log({ status: 'not_held' }))).rejects.toThrow(/already logged/)
    expect(await lectures.listLectureLogs()).toHaveLength(1)
  })

  it('saves a batch all-or-nothing', async () => {
    await lectures.createLectureLog(log({ period: 3 }))
    await expect(
      lectures.createLectureLogs([log({ period: 1 }), log({ period: 3 })]),
    ).rejects.toThrow(/already logged/)
    expect(await lectures.listLectureLogs()).toHaveLength(1)

    const saved = await lectures.createLectureLogs([log({ period: 1 }), log({ period: 2 })])
    expect(saved).toHaveLength(2)
    expect(await lectures.listLectureLogs()).toHaveLength(3)
  })

  it('updates in place, keeping id and created_at and refreshing updated_at', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T10:00:00Z'))
    const created = await lectures.createLectureLog(log())
    vi.setSystemTime(new Date('2026-10-26T11:30:00Z'))

    const updated = await lectures.updateLectureLog(created.id, { status: 'not_held', reason: 'faculty_leave' })
    expect(updated).toMatchObject({ id: created.id, created_at: created.created_at, status: 'not_held', reason: 'faculty_leave' })
    expect(updated.updated_at).toBe('2026-10-26T11:30:00.000Z')
  })

  it('will not move a log onto a slot that is already logged', async () => {
    const first = await lectures.createLectureLog(log({ period: 1 }))
    await lectures.createLectureLog(log({ period: 2 }))
    await expect(lectures.updateLectureLog(first.id, { period: 2 })).rejects.toThrow(/already logged/)
  })

  it('explains when the log to update no longer exists', async () => {
    await expect(lectures.updateLectureLog('missing', {})).rejects.toThrow(/no longer exists/)
  })

  it('deletes only the given log', async () => {
    const a = await lectures.createLectureLog(log({ period: 1 }))
    await lectures.createLectureLog(log({ period: 2 }))
    await lectures.deleteLectureLog(a.id)
    expect((await lectures.listLectureLogs()).map((l) => l.period)).toEqual([2])
  })

  it('treats corrupt storage as empty instead of crashing', async () => {
    localStorage.setItem(LOGS_KEY, '{not json')
    expect(await lectures.listLectureLogs()).toEqual([])
    localStorage.setItem(LOGS_KEY, '{"not":"an array"}')
    expect(await lectures.listLectureLogs()).toEqual([])
  })

  it('gives a readable error when the browser refuses to store data', async () => {
    localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError')
    }
    const err = await lectures.createLectureLog(log()).catch((e) => e)
    expect(getErrorMessage(err)).toMatch(/Could not save to browser storage/)
  })
})

describe('lecture logs — remote data source', () => {
  let lectures
  let calls

  beforeEach(async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    vi.resetModules()
    const { api } = await import('./http')
    lectures = await import('./lectures')
    calls = mockAdapter(api, (config) => {
      if (config.method === 'get') return { data: { items: [log({ id: '1' })] } }
      if (config.method === 'post') {
        const body = bodyOf(config)
        return body.period === 9 ? { status: 409, data: { detail: 'Slot already logged' } } : { data: { ...body, id: 'new' } }
      }
      if (config.method === 'patch') return { data: { ...log({ id: 'a/b' }), ...bodyOf(config) } }
      return { status: 204 }
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('lists over HTTP with the filter as query params and unwraps `items`', async () => {
    const items = await lectures.listLectureLogs({ section: 'V A', course_id: 'ML_VA' })
    expect(items).toHaveLength(1)
    expect(calls[0].url).toBe('/api/v1/lectures')
    expect(calls[0].params).toEqual({ section: 'V A', course_id: 'ML_VA' })
  })

  it('creates with POST, updates with PATCH on an encoded id and deletes with DELETE', async () => {
    expect((await lectures.createLectureLog(log())).id).toBe('new')
    expect((await lectures.updateLectureLog('a/b', { topic: 'SVM' })).topic).toBe('SVM')
    await lectures.deleteLectureLog('a/b')

    expect(calls.map((c) => `${c.method.toUpperCase()} ${c.url}`)).toEqual([
      'POST /api/v1/lectures',
      'PATCH /api/v1/lectures/a%2Fb',
      'DELETE /api/v1/lectures/a%2Fb',
    ])
    expect(bodyOf(calls[1])).toEqual({ topic: 'SVM' })
  })

  it('surfaces a 409 conflict from the server', async () => {
    const err = await lectures.createLectureLog(log({ period: 9 })).catch((e) => e)
    expect(err.response.status).toBe(409)
    expect(getErrorMessage(err)).toBe('Slot already logged')
  })

  it('never touches localStorage', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() })
    await lectures.createLectureLogs([log({ period: 1 }), log({ period: 2 })])
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(calls).toHaveLength(2)
    vi.unstubAllGlobals()
  })
})
