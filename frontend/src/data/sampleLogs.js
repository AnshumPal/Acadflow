/**
 * Demo data: builds illustrative lecture logs for one section from the semester start up to
 * (not including) `until`, so the progress dashboard has something to show in a presentation.
 * Seeded by the section name, so the same section always gets the same logs.
 */
import { dayIndexOf, teachingDates } from '../utils/calendar'
import { sessionsForDay } from '../utils/schedule'
import { logForSession } from '../utils/lectureLogs'
import { suggestUnit } from '../utils/progress'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const MISSED_REASONS = ['faculty_leave', 'faculty_leave', 'event', 'holiday', 'other']

export function buildSampleLogs({ section, sectionClasses, courses, calendar, numDays, syllabusFor, until }) {
  const random = mulberry32(hash(section))
  const reliability = new Map() // course id → chance a lecture was held
  const covered = new Map() // course id → Map(unit id → periods)
  const logs = []

  for (const date of teachingDates(calendar, numDays).filter((d) => d < until)) {
    for (const session of sessionsForDay(sectionClasses, dayIndexOf(date), courses, section)) {
      if (!session.course_id || session.slotType === 'extra') continue
      if (!reliability.has(session.course_id)) reliability.set(session.course_id, 0.62 + random() * 0.36)

      const roll = random()
      if (roll > 0.97) continue // left unlogged, so the audit has something to flag

      if (roll < reliability.get(session.course_id)) {
        const courseCoverage = covered.get(session.course_id) ?? new Map()
        const unit = suggestUnit(syllabusFor(session.course).units, courseCoverage)
        if (unit) courseCoverage.set(unit.id, (courseCoverage.get(unit.id) ?? 0) + session.periods)
        covered.set(session.course_id, courseCoverage)
        logs.push(
          logForSession({ section, session, date, status: 'conducted', unit_id: unit?.id ?? null, topic: '', reason: null, remarks: '' }),
        )
      } else {
        const reason = MISSED_REASONS[Math.floor(random() * MISSED_REASONS.length)]
        logs.push(logForSession({ section, session, date, status: 'not_held', unit_id: null, topic: '', reason, remarks: '' }))
      }
    }
  }
  return logs
}
