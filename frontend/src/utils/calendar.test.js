import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayIndexOf,
  latestOccurrence,
  nonTeachingReason,
  teachingDates,
  toISODate,
  weekOfSemester,
} from './calendar'
import { DEFAULT_CALENDAR } from '../data/academicCalendar'

describe('calendar helpers', () => {
  it('formats local dates without shifting to UTC (00:30 IST stays the same day)', () => {
    expect(toISODate(new Date(2026, 9, 31, 0, 30))).toBe('2026-10-31')
  })

  it('maps dates onto timetable days, Monday = 0', () => {
    expect(dayIndexOf('2026-10-26')).toBe(0) // Monday
    expect(dayIndexOf('2026-10-31')).toBe(5) // Saturday
    expect(dayIndexOf(addDays('2026-10-31', 1))).toBe(6) // Sunday, 1 Nov
  })

  it('classifies non-teaching days', () => {
    expect(nonTeachingReason('2026-07-19', DEFAULT_CALENDAR, 6)).toBe('outside_semester')
    expect(nonTeachingReason('2026-11-01', DEFAULT_CALENDAR, 6)).toBe('weekly_off')
    expect(nonTeachingReason('2026-10-02', DEFAULT_CALENDAR, 6)).toBe('holiday')
    expect(nonTeachingReason('2026-10-26', DEFAULT_CALENDAR, 6)).toBeNull()
  })

  it('counts the default RBU semester: 18 weeks of Mon–Sat minus 2 holidays', () => {
    expect(teachingDates(DEFAULT_CALENDAR, 6)).toHaveLength(106)
    expect(weekOfSemester('2026-10-31', DEFAULT_CALENDAR)).toBe(15)
    expect(weekOfSemester(DEFAULT_CALENDAR.semester_end, DEFAULT_CALENDAR)).toBe(18)
  })

  it('finds the most recent date a weekly class ran', () => {
    expect(latestOccurrence(0, '2026-10-31')).toBe('2026-10-26')
    expect(latestOccurrence(5, '2026-10-31')).toBe('2026-10-31')
  })
})
