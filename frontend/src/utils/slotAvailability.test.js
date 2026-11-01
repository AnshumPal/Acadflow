import { describe, expect, it } from 'vitest'
import { evaluateDay } from './slotAvailability'

const cls = (day, period, room, course_name, teachers = [], extra = {}) => ({ day, period, room, course_name, teachers, ...extra })
const recess = (day, period) => cls(day, period, 'Campus', 'RECESS', [], { is_recess: true })

// Monday (day 0) of two sections. Each period is busy for a different reason.
const schedule = {
  A: [
    cls(0, 1, 'R1', 'Maths', ['T9']), // P1: section busy
    recess(0, 2), //                     P2: recess
    cls(0, 4, 'R1', 'Physics (Extra)', ['T8']), // P4: section busy (suffix stripped in the reason)
  ],
  B: [
    cls(0, 3, 'R2', 'Chemistry', ['T1']), // P3: our teacher teaches B
    cls(0, 5, 'R1', 'Biology', ['T7']), //  P5: every classroom taken
    cls(0, 5, 'R2', 'Geography', ['T6']),
    cls(0, 6, 'R2', 'Art', ['T5']), //       P6: only R1 left
    recess(0, 6), //                         recess rows do not occupy a room
  ],
}
const rooms = ['R1', 'R2', 'Lab1']
const theory = { teachers: ['T1'], is_lab: false }
const lab = { teachers: ['T2'], is_lab: true }

const evaluate = (overrides) => evaluateDay({ schedule, section: 'A', course: theory, day: 0, rooms, numPeriods: 7, ...overrides })

describe('evaluateDay (mirror of the backend greedy reschedule search)', () => {
  it('explains why each busy period is unavailable, checking section, then teacher, then rooms', () => {
    const { periods } = evaluate()
    expect(periods.map((p) => (p.free ? `free:${p.rooms.join('+')}` : p.reason))).toEqual([
      'A has Maths',
      'Recess',
      'T1 is teaching B',
      'A has Physics',
      'No free classroom',
      'free:R1',
      'free:R1+R2',
    ])
  })

  it('lands on the first free period and the first matching room, like the backend', () => {
    expect(evaluate().firstFree).toMatchObject({ period: 6, room: 'R1' })
  })

  it('only offers lab rooms to lab courses', () => {
    const { firstFree, periods } = evaluate({ course: lab })
    expect(firstFree).toMatchObject({ period: 3, room: 'Lab1' })
    expect(periods.filter((p) => p.free).every((p) => p.rooms.every((r) => r === 'Lab1'))).toBe(true)
  })

  it('says so when no room of the right kind exists at all', () => {
    const { periods, firstFree } = evaluate({ course: lab, rooms: ['R1', 'R2'] })
    expect(firstFree).toBeNull()
    expect(periods.at(-1).reason).toBe('No lab rooms configured')
  })

  it('returns every period free on an empty day', () => {
    const { periods, firstFree } = evaluate({ day: 3 })
    expect(periods.every((p) => p.free)).toBe(true)
    expect(firstFree).toMatchObject({ period: 1, room: 'R1' })
  })

  describe('lab blocks (span 2)', () => {
    it('needs the next period free too, with a room free for both', () => {
      const { periods, firstFree } = evaluate({ course: lab, span: 2 })
      expect(periods[2]).toMatchObject({ period: 3, free: false, reason: 'A has Physics' }) // P4 is busy
      expect(firstFree).toMatchObject({ period: 5, room: 'Lab1' }) // P5–P6
    })

    it('cannot start a block in the last period', () => {
      const { periods } = evaluate({ course: lab, span: 2 })
      expect(periods.at(-1)).toMatchObject({ period: 7, free: false, reason: 'Not enough periods left for a lab block' })
    })

    it('rejects a block when no single lab room is free for both periods', () => {
      const busySchedule = {
        ...schedule,
        B: [...schedule.B, cls(0, 6, 'Lab1', 'Robotics', ['T4'])],
        C: [cls(0, 5, 'Lab2', 'Electronics', ['T3'])],
      }
      const { periods } = evaluateDay({ schedule: busySchedule, section: 'A', course: lab, day: 0, rooms: ['Lab1', 'Lab2'], numPeriods: 7, span: 2 })
      expect(periods[4]).toMatchObject({ period: 5, free: false, reason: 'No lab room free for both periods' })
    })
  })
})
