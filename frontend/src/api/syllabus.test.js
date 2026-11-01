import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStorage } from '../test/memoryStorage'
import { bodyOf, mockAdapter } from '../test/mockAdapter'
import { DEFAULT_CALENDAR } from '../data/academicCalendar'

const units = [{ id: 'u1', title: 'Intro', planned_lectures: 8 }]

describe('normalizeCalendar', () => {
  it('falls back to the default semester when the value is missing or incomplete', async () => {
    const { normalizeCalendar } = await import('./syllabus')
    expect(normalizeCalendar(null)).toEqual(DEFAULT_CALENDAR)
    expect(normalizeCalendar({ semester_start: '2026-07-20' })).toEqual(DEFAULT_CALENDAR)
    // the default is copied, never shared
    normalizeCalendar(null).holidays.push({ date: 'x' })
    expect(DEFAULT_CALENDAR.holidays).toHaveLength(2)
  })

  it('drops holidays without a date, labels the rest and sorts them', async () => {
    const { normalizeCalendar } = await import('./syllabus')
    const result = normalizeCalendar({
      semester_start: '2026-07-20',
      semester_end: '2026-11-21',
      holidays: [{ date: '2026-10-02', label: 'Gandhi Jayanti' }, { label: 'no date' }, null, { date: '2026-08-15' }],
    })
    expect(result.holidays).toEqual([
      { date: '2026-08-15', label: 'Holiday' },
      { date: '2026-10-02', label: 'Gandhi Jayanti' },
    ])
  })
})

describe('syllabus and calendar — local data source', () => {
  let syllabus

  beforeEach(async () => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    syllabus = await import('./syllabus')
  })

  afterEach(() => vi.unstubAllGlobals())

  it('returns the default calendar until one is saved, then the saved one', async () => {
    expect(await syllabus.getAcademicCalendar()).toEqual(DEFAULT_CALENDAR)
    const next = { semester_start: '2026-08-01', semester_end: '2026-12-01', holidays: [] }
    await syllabus.saveAcademicCalendar(next)
    expect(await syllabus.getAcademicCalendar()).toEqual(next)
  })

  it('keeps one syllabus per section and course, even when course ids repeat across sections', async () => {
    await syllabus.saveSyllabus({ section: 'A', course_id: 'CS101', units })
    await syllabus.saveSyllabus({ section: 'B', course_id: 'CS101', units: [] })
    await syllabus.saveSyllabus({ section: 'A', course_id: 'CS101', units: [...units, { id: 'u2', title: 'More', planned_lectures: 4 }] })

    const a = await syllabus.listSyllabi('A')
    expect(a).toHaveLength(1)
    expect(a[0].units).toHaveLength(2)
    expect(a[0].updated_at).toEqual(expect.any(String))
    expect(await syllabus.listSyllabi('B')).toHaveLength(1)
    expect(await syllabus.listSyllabi()).toHaveLength(2)
  })

  it('deletes only the given section and course', async () => {
    await syllabus.saveSyllabus({ section: 'A', course_id: 'CS101', units })
    await syllabus.saveSyllabus({ section: 'B', course_id: 'CS101', units })
    await syllabus.deleteSyllabus('A', 'CS101')
    expect((await syllabus.listSyllabi()).map((s) => s.section)).toEqual(['B'])
  })
})

describe('syllabus and calendar — remote data source', () => {
  let syllabus
  let calls

  beforeEach(async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    vi.resetModules()
    const { api } = await import('./http')
    syllabus = await import('./syllabus')
    calls = mockAdapter(api, (config) => {
      if (config.url === '/api/v1/calendar') {
        return { data: config.method === 'put' ? bodyOf(config) : { semester_start: '2026-07-20', semester_end: '2026-11-21' } }
      }
      if (config.method === 'get') return { data: { items: [{ section: 'A', course_id: 'CS 101', units }] } }
      return { data: config.data ? bodyOf(config) : null }
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('lists by section and saves with PUT on the encoded course id', async () => {
    expect(await syllabus.listSyllabi('A')).toHaveLength(1)
    await syllabus.saveSyllabus({ section: 'A', course_id: 'CS 101', units })
    await syllabus.deleteSyllabus('A', 'CS 101')

    expect(calls.map((c) => `${c.method.toUpperCase()} ${c.url}`)).toEqual([
      'GET /api/v1/syllabus',
      'PUT /api/v1/syllabus/CS%20101',
      'DELETE /api/v1/syllabus/CS%20101',
    ])
    expect(calls[0].params).toEqual({ section: 'A' })
    expect(calls[2].params).toEqual({ section: 'A' })
  })

  it('normalises the calendar the server returns', async () => {
    expect((await syllabus.getAcademicCalendar()).holidays).toEqual([])
    const saved = await syllabus.saveAcademicCalendar({ semester_start: '2026-07-20', semester_end: '2026-11-21', holidays: [{ date: '2026-08-15' }] })
    expect(saved.holidays).toEqual([{ date: '2026-08-15', label: 'Holiday' }])
  })
})
