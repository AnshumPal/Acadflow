// Helpers for reading the generated schedule: { [section]: ScheduledClass[] }.
// ScheduledClass has no course id, so classes are matched to catalog courses by name.

export const PERIOD_TIMES = ['9–10', '10–11', '11–12', '12–1', '1–2', '2–3', '3–4', '4–5']

const EXTRA_RE = /\s*\(Extra\)\s*$/i
const RESCHEDULED_RE = /\s*\(Rescheduled\)\s*$/i

export function normalizeCourseName(name = '') {
  return name.replace(RESCHEDULED_RE, '').replace(EXTRA_RE, '').trim()
}

export function parseClassName(courseName = '') {
  return {
    title: normalizeCourseName(courseName),
    extra: EXTRA_RE.test(courseName),
    rescheduled: RESCHEDULED_RE.test(courseName),
  }
}

/** 'regular' | 'extra' | 'rescheduled', from the suffix the backend appends to course_name. */
export function slotTypeOf(courseName) {
  const { extra, rescheduled } = parseClassName(courseName)
  if (extra) return 'extra'
  if (rescheduled) return 'rescheduled'
  return 'regular'
}

export function findCourseForClass(cls, section, catalog) {
  const base = normalizeCourseName(cls.course_name)
  return catalog.find((c) => c.section === section && c.name === base)
}

export function isLabClass(cls, course) {
  if (course) return Boolean(course.is_lab)
  return /lab/i.test(cls.room || '')
}

export function periodLabel(period, periods = 1) {
  return periods > 1 ? `P${period}–P${period + periods - 1}` : `P${period}`
}

export function periodTimeRange(period, periods = 1) {
  const first = PERIOD_TIMES[period - 1]
  const last = PERIOD_TIMES[period + periods - 2]
  if (!first || !last) return ''
  return `${first.split('–')[0]}–${last.split('–')[1]}`
}

/**
 * Teaching sessions of one section on one day, ordered by period.
 * A lab's two consecutive periods (same course, same room) form one session; parallel
 * electives in the same period stay separate sessions because different students attend them.
 */
export function sessionsForDay(sectionClasses, day, catalog, section) {
  const teaching = sectionClasses
    .filter((c) => c.day === day && !c.is_recess)
    .sort((a, b) => a.period - b.period)
  const used = new Set()
  const sessions = []

  for (const cls of teaching) {
    if (used.has(cls)) continue
    const course = findCourseForClass(cls, section, catalog)
    const lab = isLabClass(cls, course)
    const partner = lab
      ? teaching.find(
          (o) =>
            !used.has(o) &&
            o !== cls &&
            o.period === cls.period + 1 &&
            o.course_name === cls.course_name &&
            o.room === cls.room,
        )
      : null
    used.add(cls)
    if (partner) used.add(partner)

    sessions.push({
      key: `${day}-${cls.period}-${cls.course_name}-${cls.room}`,
      course,
      course_id: course?.id ?? null,
      title: normalizeCourseName(cls.course_name),
      isLab: lab,
      slotType: slotTypeOf(cls.course_name),
      day,
      period: cls.period,
      periods: partner ? 2 : 1,
      room: cls.room,
      teachers: cls.teachers ?? [],
      classes: partner ? [cls, partner] : [cls],
    })
  }
  return sessions
}

/** The session (one class, or both periods of a lab block) that `cls` belongs to. */
export function sessionOfClass(sectionClasses, cls, catalog, section) {
  return (
    sessionsForDay(sectionClasses, cls.day, catalog, section).find((s) =>
      s.classes.some((c) => c === cls || (c.period === cls.period && c.course_name === cls.course_name && c.room === cls.room)),
    ) ?? null
  )
}

/** Returns a copy of `schedule` without `classes` in `section`. */
export function removeClasses(schedule, section, classes) {
  const drop = new Set(classes)
  return { ...schedule, [section]: (schedule[section] ?? []).filter((c) => !drop.has(c)) }
}
