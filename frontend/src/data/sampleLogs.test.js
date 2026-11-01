import { describe, expect, it } from 'vitest'
import { buildSampleLogs } from './sampleLogs'
import { templateSyllabusFor } from './sampleSyllabus'
import { DEFAULT_CALENDAR } from './academicCalendar'

const courses = [
  { id: 'ML', name: 'Machine Learning (ML)', section: 'V A', teachers: ['T'], hours: 3, is_lab: false },
  { id: 'IDEA', name: 'Idea Lab', section: 'V A', teachers: ['T'], hours: 2, is_lab: true },
]
const sectionClasses = [
  { day: 0, period: 1, room: 'R1', course_name: 'Machine Learning (ML)', teachers: ['T'] },
  { day: 2, period: 1, room: 'R1', course_name: 'Machine Learning (ML)', teachers: ['T'] },
  { day: 1, period: 5, room: 'Lab1', course_name: 'Idea Lab', teachers: ['T'] },
  { day: 1, period: 6, room: 'Lab1', course_name: 'Idea Lab', teachers: ['T'] },
  { day: 3, period: 2, room: 'R1', course_name: 'Machine Learning (ML) (Extra)', teachers: ['T'] },
]
const syllabusFor = (course) => ({ units: templateSyllabusFor(course.name) ?? [], source: 'template' })
const args = { section: 'V A', sectionClasses, courses, calendar: DEFAULT_CALENDAR, numDays: 6, syllabusFor, until: '2026-10-31' }

describe('buildSampleLogs (demo data)', () => {
  it('is deterministic for a section', () => {
    expect(buildSampleLogs(args)).toEqual(buildSampleLogs(args))
  })

  it('only logs past regular slots, never extras, holidays or dates from `until` on', () => {
    const logs = buildSampleLogs(args)
    expect(logs.length).toBeGreaterThan(0)
    expect(logs.every((l) => l.date < '2026-10-31' && l.slot_type === 'regular')).toBe(true)
    expect(logs.some((l) => DEFAULT_CALENDAR.holidays.some((h) => h.date === l.date))).toBe(false)
    expect(logs.filter((l) => l.course_id === 'IDEA').every((l) => l.periods === 2 && l.period === 5)).toBe(true)
  })

  it('walks through syllabus units in order', () => {
    const order = templateSyllabusFor('Machine Learning (ML)').map((u) => u.id)
    const unitIndexes = buildSampleLogs(args)
      .filter((l) => l.course_id === 'ML' && l.status === 'conducted')
      .map((l) => order.indexOf(l.unit_id))
    expect(unitIndexes.every((idx, i) => i === 0 || idx >= unitIndexes[i - 1])).toBe(true)
  })
})
