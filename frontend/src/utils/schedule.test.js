import { describe, expect, it } from 'vitest'
import {
  findCourseForClass,
  parseClassName,
  periodLabel,
  periodTimeRange,
  removeClasses,
  sessionOfClass,
  sessionsForDay,
  slotTypeOf,
} from './schedule'

const catalog = [
  { id: 'CN', name: 'Computer Networks (CN)', section: 'A', is_lab: false },
  { id: 'PDA', name: 'PDA', section: 'A', is_lab: false },
  { id: 'IP', name: 'IP', section: 'A', is_lab: false },
  { id: 'LAB', name: 'CN Lab', section: 'A', is_lab: true },
]
const cls = (day, period, room, course_name) => ({ day, period, room, course_name, teachers: ['T'] })
const monday = [
  cls(0, 1, 'R1', 'Computer Networks (CN) (Rescheduled)'),
  cls(0, 2, 'R1', 'PDA'), // parallel electives in one period
  cls(0, 2, 'R2', 'IP'),
  cls(0, 3, 'Lab1', 'CN Lab'), // two-period lab
  cls(0, 4, 'Lab1', 'CN Lab'),
  { day: 0, period: 5, room: 'Campus', course_name: 'RECESS', teachers: [], is_recess: true },
]

describe('schedule helpers', () => {
  it('reads the backend suffixes', () => {
    expect(parseClassName('ML (Extra)')).toEqual({ title: 'ML', extra: true, rescheduled: false })
    expect(slotTypeOf('ML (Rescheduled)')).toBe('rescheduled')
    expect(slotTypeOf('ML')).toBe('regular')
    expect(findCourseForClass(monday[0], 'A', catalog).id).toBe('CN')
  })

  it('groups a lab block into one session and keeps parallel electives separate', () => {
    const sessions = sessionsForDay(monday, 0, catalog, 'A')
    expect(sessions.map((s) => `${periodLabel(s.period, s.periods)} ${s.course_id} ${s.slotType}`)).toEqual([
      'P1 CN rescheduled',
      'P2 PDA regular',
      'P2 IP regular',
      'P3–P4 LAB regular',
    ])
    expect(sessionOfClass(monday, monday[4], catalog, 'A').classes).toEqual([monday[3], monday[4]])
  })

  it('labels period ranges with clock times', () => {
    expect(periodTimeRange(3, 2)).toBe('11–1')
    expect(periodTimeRange(1)).toBe('9–10')
  })

  it('removes classes without mutating the schedule', () => {
    const schedule = { A: monday, B: [] }
    const next = removeClasses(schedule, 'A', [monday[3], monday[4]])
    expect(next.A).toHaveLength(monday.length - 2)
    expect(schedule.A).toHaveLength(monday.length)
    expect(next.B).toBe(schedule.B)
  })
})
