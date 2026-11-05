// Date helpers that map real calendar dates onto the weekly timetable (day 0 = Monday).
// All dates are local-time 'YYYY-MM-DD' strings, which also compare correctly as strings.

const pad = (n) => String(n).padStart(2, '0')
const MS_PER_DAY = 86_400_000

// Never use toISOString() for this: in IST it returns the previous day before 05:30.
export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISODate(new Date())

export function addDays(iso, n) {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseISODate(toIso) - parseISODate(fromIso)) / MS_PER_DAY)
}

/** Timetable day index: Monday = 0 … Saturday = 5, Sunday = 6. */
export function dayIndexOf(iso) {
  return (parseISODate(iso).getDay() + 6) % 7
}

export function formatDate(iso, options) {
  return parseISODate(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  })
}

export function holidayOn(iso, calendar) {
  return calendar?.holidays?.find((h) => h.date === iso) ?? null
}

/** Why `iso` is not a teaching day ('outside_semester' | 'weekly_off' | 'holiday'), or null if it is one. */
export function nonTeachingReason(iso, calendar, numDays) {
  if (calendar && (iso < calendar.semester_start || iso > calendar.semester_end)) return 'outside_semester'
  if (dayIndexOf(iso) >= numDays) return 'weekly_off'
  if (holidayOn(iso, calendar)) return 'holiday'
  return null
}

/** Teaching dates in [from, to], clamped to the semester. */
export function teachingDates(calendar, numDays, from = calendar.semester_start, to = calendar.semester_end) {
  const start = from < calendar.semester_start ? calendar.semester_start : from
  const end = to > calendar.semester_end ? calendar.semester_end : to
  const dates = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!nonTeachingReason(d, calendar, numDays)) dates.push(d)
  }
  return dates
}

export function weekOfSemester(iso, calendar) {
  return Math.floor(daysBetween(calendar.semester_start, iso) / 7) + 1
}

/** Most recent date (on or before `onOrBefore`) that falls on timetable day `dayIndex`. */
export function latestOccurrence(dayIndex, onOrBefore = todayISO()) {
  const back = (dayIndexOf(onOrBefore) - dayIndex + 7) % 7
  return addDays(onOrBefore, -back)
}
