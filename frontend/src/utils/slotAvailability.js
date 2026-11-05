import { normalizeCourseName } from './schedule'

const isLabRoom = (room) => /lab/i.test(room)

function checkPeriod({ schedule, section, course, day, period, rooms }) {
  const own = (schedule[section] ?? []).find((c) => c.day === day && c.period === period)
  if (own) {
    return {
      period,
      free: false,
      reason: own.is_recess ? 'Recess' : `${section} has ${normalizeCourseName(own.course_name)}`,
    }
  }

  for (const [sec, classes] of Object.entries(schedule)) {
    for (const c of classes) {
      if (c.day !== day || c.period !== period) continue
      const teacher = course.teachers.find((t) => c.teachers?.includes(t))
      if (teacher) return { period, free: false, reason: `${teacher} is teaching ${sec}` }
    }
  }

  const occupied = new Set(
    Object.values(schedule)
      .flat()
      .filter((c) => c.day === day && c.period === period && !c.is_recess)
      .map((c) => c.room),
  )
  const roomKind = course.is_lab ? 'lab' : 'classroom'
  const matching = rooms.filter((r) => isLabRoom(r) === Boolean(course.is_lab))
  const free = matching.filter((r) => !occupied.has(r))
  if (free.length === 0) {
    return {
      period,
      free: false,
      reason: matching.length ? `No free ${roomKind}` : `No ${roomKind} rooms configured`,
    }
  }
  return { period, free: true, rooms: free, room: free[0] }
}

/**
 * Mirrors the greedy search in Backend/main.py `dynamic_reschedule` so the UI can preview where a
 * class will land. For each period of `day`, in order, it checks that:
 *   1. the section has nothing there (recess counts as busy),
 *   2. none of the course's teachers is teaching any section then,
 *   3. a room of the matching type (lab ↔ "lab" in its name) is unoccupied.
 * The backend takes the first period that passes and the first matching room.
 * With `span: 2` a period is only free if the next one is too, with a common room (lab blocks).
 */
export function evaluateDay({ schedule, section, course, day, rooms, numPeriods, span = 1 }) {
  const single = []
  for (let period = 1; period <= numPeriods; period++) {
    single.push(checkPeriod({ schedule, section, course, day, period, rooms }))
  }

  const periods =
    span === 1
      ? single
      : single.map((slot, i) => {
          const block = single.slice(i, i + span)
          if (block.length < span) return { ...slot, free: false, reason: 'Not enough periods left for a lab block' }
          const blocker = block.find((s) => !s.free)
          if (blocker) return { ...slot, free: false, reason: blocker.reason }
          const common = block.reduce((acc, s) => acc.filter((r) => s.rooms.includes(r)), block[0].rooms)
          if (common.length === 0) return { ...slot, free: false, reason: 'No lab room free for both periods' }
          return { ...slot, rooms: common, room: common[0] }
        })

  return { day, periods, firstFree: periods.find((p) => p.free) ?? null }
}
