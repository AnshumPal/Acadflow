// Shared shape helpers for lecture logs (see src/api/lectures.js for the full schema).

export const logKey = (courseId, date, period) => `${courseId}|${date}|${period}`

/** Sort comparator: oldest date first, then by period. */
export const compareLogs = (a, b) => a.date.localeCompare(b.date) || a.period - b.period

/** A log body for one timetable session (from sessionsForDay / sessionOfClass) on `date`. */
export function logForSession({ section, session, date, ...fields }) {
  return {
    section,
    course_id: session.course_id,
    course_name: session.title,
    date,
    day: session.day,
    period: session.period,
    periods: session.periods,
    room: session.room,
    teachers: session.teachers,
    slot_type: session.slotType,
    ...fields,
  }
}
