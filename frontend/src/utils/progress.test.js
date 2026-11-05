import { describe, expect, it } from 'vitest'
import { buildAudit, buildSectionProgress, coverageByUnit, paceStatus, suggestUnit } from './progress'

// Two weeks, Monday–Friday, with a holiday on Wednesday 22 July:
// teaching days 20, 21, 23, 24, 27, 28, 29, 30, 31 → 9 days, 2 teaching weeks.
const calendar = {
  semester_start: '2026-07-20',
  semester_end: '2026-07-31',
  holidays: [{ date: '2026-07-22', label: 'Holiday' }],
}
const numDays = 5
const asOf = '2026-07-27' // completed teaching days: 20, 21, 23, 24 → 4 of 9

const theory = { id: 'T1', name: 'Theory', section: 'A', teachers: ['P1'], hours: 3, is_lab: false }
const lab = { id: 'L1', name: 'Lab', section: 'A', teachers: ['P2'], hours: 2, is_lab: true }
const courses = [theory, lab]

const cls = (day, period, room, course_name, extra = {}) => ({ day, period, room, course_name, teachers: ['P1'], ...extra })
const sectionClasses = [
  cls(0, 1, 'R1', 'Theory'), //            Mon P1
  cls(3, 2, 'R1', 'Theory'), //            Thu P2
  cls(4, 1, 'R1', 'Theory'), //            Fri P1
  cls(1, 3, 'Lab1', 'Lab'), //             Tue P3–P4 lab block
  cls(1, 4, 'Lab1', 'Lab'),
  cls(1, 1, 'R1', 'Theory (Extra)'), //    one-off extra slot, never "missing"
  cls(0, 3, 'Campus', 'RECESS', { is_recess: true }),
]

const theoryUnits = [
  { id: 'u1', title: 'One', planned_lectures: 2 },
  { id: 'u2', title: 'Two', planned_lectures: 3 },
]
const syllabusFor = (course) =>
  course.id === 'T1' ? { units: theoryUnits, source: 'custom' } : { units: [], source: 'none' }

const log = (course_id, date, period, status, extra = {}) => ({
  course_id,
  date,
  period,
  periods: 1,
  status,
  slot_type: 'regular',
  updated_at: `${date}T10:00:00Z`,
  ...extra,
})
const baseLogs = [
  log('T1', '2026-07-20', 1, 'conducted', { unit_id: 'u1' }),
  log('T1', '2026-07-23', 2, 'not_held', { reason: 'faculty_leave' }),
  // Fri 24 Jul P1 (Theory) left unlogged
  log('L1', '2026-07-21', 3, 'conducted', { periods: 2 }),
]

const build = (logs = baseLogs, overrides = {}) =>
  buildSectionProgress({ section: 'A', courses, sectionClasses, logs, calendar, numDays, syllabusFor, asOf, ...overrides })

describe('paceStatus', () => {
  it('applies the on-track and at-risk thresholds', () => {
    expect(paceStatus(1.2, 10)).toBe('on_track')
    expect(paceStatus(0.9, 10)).toBe('on_track')
    expect(paceStatus(0.89, 10)).toBe('at_risk')
    expect(paceStatus(0.75, 10)).toBe('at_risk')
    expect(paceStatus(0.74, 10)).toBe('behind')
    expect(paceStatus(1, 0)).toBe('no_plan')
  })
})

describe('coverageByUnit and suggestUnit', () => {
  it('counts conducted periods per unit, ignoring untagged and not-held logs', () => {
    const covered = coverageByUnit([
      log('T1', 'd', 1, 'conducted', { unit_id: 'u1' }),
      log('T1', 'd', 2, 'conducted', { unit_id: 'u1', periods: 2 }),
      log('T1', 'd', 3, 'conducted'),
      log('T1', 'd', 4, 'not_held', { unit_id: 'u2' }),
    ])
    expect([...covered]).toEqual([['u1', 3]])
  })

  it('suggests the first unit not yet covered, the last one once all are, and none without units', () => {
    expect(suggestUnit(theoryUnits, new Map([['u1', 1]])).id).toBe('u1')
    expect(suggestUnit(theoryUnits, new Map([['u1', 2]])).id).toBe('u2')
    expect(suggestUnit(theoryUnits, new Map([['u1', 2], ['u2', 3]])).id).toBe('u2')
    expect(suggestUnit([], new Map())).toBeNull()
  })
})

describe('buildSectionProgress', () => {
  it('works out teaching days, weeks and the share of the semester elapsed', () => {
    const progress = build()
    expect(progress.teachingDays).toEqual({ total: 9, completed: 4 })
    expect(progress.week).toEqual({ current: 2, total: 2 })
  })

  it('uses the syllabus total as target and paces it by teaching days elapsed', () => {
    const t1 = build().courses.find((r) => r.course.id === 'T1')
    expect(t1).toMatchObject({
      target: 5, // 2 + 3 planned periods
      targetSource: 'custom',
      creditTarget: 6, // 3 h/week × 2 teaching weeks
      expected: 2, // round(5 × 4/9)
      conducted: 1,
      notHeld: 1,
      compensated: 0,
      uncompensated: 1,
      unlogged: 1, // Fri 24 Jul; the extra slot on Tuesdays is not expected every week
      deficit: 1,
      status: 'behind', // 1 / 2 = 50%
      unitsDone: 0,
    })
    expect(t1.completion).toBeCloseTo(0.2)
    expect(t1.currentUnit.id).toBe('u1')
    expect(t1.units.map((u) => u.covered)).toEqual([1, 0])
    expect(t1.lastLog.date).toBe('2026-07-23')
  })

  it('falls back to weekly hours × teaching weeks without syllabus units, counting a lab block as 2 periods', () => {
    const l1 = build().courses.find((r) => r.course.id === 'L1')
    expect(l1).toMatchObject({ target: 4, targetSource: 'credits', expected: 2, conducted: 2, unlogged: 0, status: 'on_track' })
  })

  it('adds up section totals and status counts', () => {
    const { totals, statusCounts } = build()
    expect(totals).toMatchObject({ target: 9, expected: 4, conducted: 3, notHeld: 1, uncompensated: 1, unlogged: 1, status: 'at_risk' })
    expect(totals.pace).toBe(0.75)
    expect(statusCounts).toEqual({ behind: 1, on_track: 1 })
  })

  it('counts a conducted extra class as compensation for a lost period', () => {
    const t1 = build([...baseLogs, log('T1', '2026-07-21', 1, 'conducted', { slot_type: 'extra', unit_id: 'u1' })]).courses[0]
    expect(t1).toMatchObject({ conducted: 2, compensated: 1, uncompensated: 0, status: 'on_track' })
    expect(t1.units[0]).toMatchObject({ covered: 2, done: true })
    expect(t1.currentUnit.id).toBe('u2')
  })

  it('expects nothing before the semester starts', () => {
    const progress = build([], { asOf: '2026-07-01' })
    expect(progress.teachingDays.completed).toBe(0)
    expect(progress.week.current).toBe(0)
    expect(progress.courses.every((r) => r.expected === 0 && r.unlogged === 0 && r.status === 'on_track')).toBe(true)
  })

  it('ignores logs of other courses and sections that are not in the catalog', () => {
    const progress = build([...baseLogs, log('X9', '2026-07-20', 1, 'conducted')])
    expect(progress.totals.conducted).toBe(3)
  })
})

describe('audit findings', () => {
  it('lists problems most severe first', () => {
    const audit = build().audit
    expect(audit.map((f) => `${f.severity}:${f.id}`)).toEqual([
      'high:pace-T1',
      'medium:lost',
      'medium:unlogged',
      'low:credit-targets',
      'info:timetable-changes',
    ])
    expect(audit[0].detail).toBe('1 of 2 expected periods conducted, 1 short.')
    expect(audit[1]).toMatchObject({ title: '1 lost period not made up', detail: expect.stringContaining('Theory (1)') })
    expect(audit[4].detail).toBe('0 rescheduled and 1 extra slot this week.')
  })

  it('says all is well when nothing needs attention', () => {
    const row = { course: { id: 'C', name: 'C' }, status: 'on_track', uncompensated: 0, unlogged: 0, targetSource: 'custom', target: 10 }
    expect(buildAudit([row])).toEqual([expect.objectContaining({ id: 'all-clear', severity: 'ok' })])
  })

  it('names the four slowest courses and folds the other off-pace ones into one finding', () => {
    const rows = [0.5, 0.8, 0.1, 0.6, 0.3, 0.7, 0.95].map((pace, i) => ({
      course: { id: `C${i}`, name: `C${i}` },
      status: pace >= 0.9 ? 'on_track' : pace >= 0.75 ? 'at_risk' : 'behind',
      pace,
      conducted: 1,
      expected: 2,
      deficit: 1,
      uncompensated: 0,
      unlogged: 0,
      targetSource: 'custom',
      target: 10,
    }))
    const ids = buildAudit(rows).map((f) => f.id)
    expect(ids).toEqual(['pace-C2', 'pace-C4', 'pace-C0', 'pace-C3', 'pace-more'])
    expect(buildAudit(rows).at(-1).title).toBe('2 more courses are behind or at risk')
  })

  it('names the three worst courses and summarises the rest', () => {
    const rows = [5, 1, 4, 2, 3].map((n, i) => ({
      course: { id: `C${i}`, name: `C${i}` },
      status: 'on_track',
      uncompensated: 0,
      unlogged: n,
      targetSource: 'custom',
      target: 10,
    }))
    const flag = buildAudit(rows).find((f) => f.id === 'unlogged')
    expect(flag.title).toBe('15 past periods not logged')
    expect(flag.detail).toBe('C0 (5), C2 (4), C4 (3) and 2 more')
  })
})
