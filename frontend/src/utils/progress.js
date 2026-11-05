// Pure syllabus-progress calculations. Every count is in periods: a theory lecture is 1,
// a lab session is 2 — the same unit the credit scheme uses (see Backend/main.py).

import { dayIndexOf, teachingDates, todayISO, weekOfSemester } from './calendar'
import { sessionsForDay, slotTypeOf } from './schedule'
import { logKey } from './lectureLogs'

// conducted ÷ expected-by-now at or above which a course counts as on track / at risk.
export const PACE_THRESHOLDS = { onTrack: 0.9, atRisk: 0.75 }

const periodsOf = (log) => Number(log.periods) || 1

/** Periods logged as conducted against each unit id of one course. */
export function coverageByUnit(courseLogs) {
  const covered = new Map()
  for (const log of courseLogs) {
    if (log.status === 'conducted' && log.unit_id) {
      covered.set(log.unit_id, (covered.get(log.unit_id) ?? 0) + periodsOf(log))
    }
  }
  return covered
}

/** The unit teaching should be on: the first one not yet fully covered (else the last one). */
export function suggestUnit(units, covered = new Map()) {
  if (!units.length) return null
  return units.find((u) => (covered.get(u.id) ?? 0) < (Number(u.planned_lectures) || 0)) ?? units[units.length - 1]
}

/** 'on_track' | 'at_risk' | 'behind', or 'no_plan' when nothing is planned. */
export function paceStatus(pace, target) {
  if (target === 0) return 'no_plan'
  if (pace >= PACE_THRESHOLDS.onTrack) return 'on_track'
  if (pace >= PACE_THRESHOLDS.atRisk) return 'at_risk'
  return 'behind'
}

/**
 * Progress of every course in one section as of `asOf`.
 *  target    – syllabus planned periods, or weekly hours × teaching weeks when no units exist
 *  expected  – target × share of the semester's teaching days already completed
 *  conducted – periods logged as conducted (extra classes included)
 *  unlogged  – timetabled periods on completed teaching days with no log at all
 */
export function buildSectionProgress({ section, courses, sectionClasses, logs, calendar, numDays, syllabusFor, asOf = todayISO() }) {
  const allDates = teachingDates(calendar, numDays)
  const completedDates = allDates.filter((d) => d < asOf)
  const elapsedShare = allDates.length ? completedDates.length / allDates.length : 0
  const teachingWeeks = Math.max(1, Math.round(allDates.length / Math.max(1, numDays)))

  const sessionsByDay = new Map()
  const sessionsOn = (day) => {
    if (!sessionsByDay.has(day)) sessionsByDay.set(day, sessionsForDay(sectionClasses, day, courses, section))
    return sessionsByDay.get(day)
  }
  const logged = new Set(logs.map((l) => logKey(l.course_id, l.date, l.period)))
  const unlogged = new Map()
  for (const date of completedDates) {
    for (const s of sessionsOn(dayIndexOf(date))) {
      // Extra slots are one-off compensation, so a week without one is not a missing log.
      if (!s.course_id || s.slotType === 'extra') continue
      if (!logged.has(logKey(s.course_id, date, s.period))) {
        unlogged.set(s.course_id, (unlogged.get(s.course_id) ?? 0) + s.periods)
      }
    }
  }

  const rows = courses.map((course) => {
    const courseLogs = logs.filter((l) => l.course_id === course.id)
    const sum = (match) => courseLogs.filter(match).reduce((n, l) => n + periodsOf(l), 0)
    const conducted = sum((l) => l.status === 'conducted')
    const notHeld = sum((l) => l.status === 'not_held')
    const compensated = sum((l) => l.status === 'conducted' && l.slot_type === 'extra')

    const { units, source } = syllabusFor(course)
    const syllabusTotal = units.reduce((n, u) => n + (Number(u.planned_lectures) || 0), 0)
    const creditTarget = (Number(course.hours) || 0) * teachingWeeks
    const target = syllabusTotal > 0 ? syllabusTotal : creditTarget
    const expected = Math.round(target * elapsedShare)
    const pace = expected > 0 ? conducted / expected : 1

    const covered = coverageByUnit(courseLogs)
    const unitRows = units.map((u) => {
      const done = covered.get(u.id) ?? 0
      return { ...u, covered: done, done: done >= (Number(u.planned_lectures) || 0) }
    })

    return {
      course,
      target,
      creditTarget,
      targetSource: syllabusTotal > 0 ? source : 'credits',
      expected,
      conducted,
      notHeld,
      compensated,
      uncompensated: Math.max(0, notHeld - compensated),
      unlogged: unlogged.get(course.id) ?? 0,
      completion: target > 0 ? Math.min(1, conducted / target) : 0,
      pace,
      deficit: Math.max(0, expected - conducted),
      status: paceStatus(pace, target),
      units: unitRows,
      unitsDone: unitRows.filter((u) => u.done).length,
      currentUnit: suggestUnit(unitRows, covered),
      lastLog: courseLogs.reduce((latest, l) => (!latest || l.date > latest.date ? l : latest), null),
    }
  })

  const total = (field) => rows.reduce((n, r) => n + r[field], 0)
  const totals = {
    target: total('target'),
    expected: total('expected'),
    conducted: total('conducted'),
    notHeld: total('notHeld'),
    compensated: total('compensated'),
    uncompensated: total('uncompensated'),
    unlogged: total('unlogged'),
  }
  totals.completion = totals.target ? Math.min(1, totals.conducted / totals.target) : 0
  totals.pace = totals.expected ? totals.conducted / totals.expected : 1
  totals.status = paceStatus(totals.pace, totals.target)

  const statusCounts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  const lastWeek = weekOfSemester(calendar.semester_end, calendar)

  return {
    asOf,
    week: { current: Math.min(lastWeek, Math.max(0, weekOfSemester(asOf, calendar))), total: lastWeek },
    teachingDays: { total: allDates.length, completed: completedDates.length },
    courses: rows,
    totals,
    statusCounts,
    audit: buildAudit(rows, sectionClasses),
  }
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, info: 3, ok: 4 }

// Courses named individually in the audit; the rest are summarised (the course list shows all).
const PACE_FLAGS_SHOWN = 4

/** Findings for the audit widget, most severe first. */
export function buildAudit(rows, sectionClasses = []) {
  const flags = []

  const offPace = rows.filter((r) => r.status === 'behind' || r.status === 'at_risk').sort((a, b) => a.pace - b.pace)
  for (const r of offPace.slice(0, PACE_FLAGS_SHOWN)) {
    flags.push({
      id: `pace-${r.course.id}`,
      severity: r.status === 'behind' ? 'high' : 'medium',
      title: `${r.course.name} is ${r.status === 'behind' ? 'behind schedule' : 'at risk'}`,
      detail: `${r.conducted} of ${r.expected} expected periods conducted, ${r.deficit} short.`,
    })
  }
  const rest = offPace.slice(PACE_FLAGS_SHOWN)
  if (rest.length > 0) {
    flags.push({
      id: 'pace-more',
      severity: rest.some((r) => r.status === 'behind') ? 'high' : 'medium',
      title: `${rest.length} more course${rest.length === 1 ? ' is' : 's are'} behind or at risk`,
      detail: 'See Course progress for the full list.',
    })
  }

  // "ML (8), CN (7), OE (3) and 2 more" for the courses with the largest `field`.
  const topCourses = (field) => {
    const affected = rows.filter((r) => r[field] > 0).sort((a, b) => b[field] - a[field])
    const listed = affected.slice(0, 3).map((r) => `${r.course.name} (${r[field]})`).join(', ')
    return { total: affected.reduce((n, r) => n + r[field], 0), list: affected.length > 3 ? `${listed} and ${affected.length - 3} more` : listed }
  }

  const lost = topCourses('uncompensated')
  if (lost.total > 0) {
    flags.push({
      id: 'lost',
      severity: 'medium',
      title: `${lost.total} lost period${lost.total === 1 ? '' : 's'} not made up`,
      detail: `${lost.list}. Add extra classes from the timetable to compensate.`,
    })
  }

  const unlogged = topCourses('unlogged')
  if (unlogged.total > 0) {
    flags.push({
      id: 'unlogged',
      severity: 'medium',
      title: `${unlogged.total} past period${unlogged.total === 1 ? '' : 's'} not logged`,
      detail: unlogged.list,
    })
  }

  const creditBased = rows.filter((r) => r.targetSource === 'credits' && r.target > 0)
  if (creditBased.length > 0) {
    flags.push({
      id: 'credit-targets',
      severity: 'low',
      title: `${creditBased.length} course${creditBased.length === 1 ? ' uses' : 's use'} a credit-based target`,
      detail: 'Add syllabus units to plan coverage unit by unit.',
    })
  }

  const slotTypes = sectionClasses.filter((c) => !c.is_recess).map((c) => slotTypeOf(c.course_name))
  const moved = slotTypes.filter((t) => t === 'rescheduled').length
  const extra = slotTypes.filter((t) => t === 'extra').length
  if (moved || extra) {
    flags.push({
      id: 'timetable-changes',
      severity: 'info',
      title: 'Timetable has manual changes',
      detail: `${moved} rescheduled and ${extra} extra slot${extra === 1 ? '' : 's'} this week.`,
    })
  }

  if (!flags.some((f) => f.severity === 'high' || f.severity === 'medium')) {
    flags.push({ id: 'all-clear', severity: 'ok', title: 'All courses on pace', detail: 'Nothing needs attention right now.' })
  }

  return flags.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}
