import { describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { revertReschedule } from './rescheduleUndo'

const previous = { A: [{ day: 0, period: 1, course_name: 'ML' }] }
const notFound = () => new AxiosError('Not Found', 'ERR_BAD_REQUEST', {}, {}, { status: 404, data: {} })

describe('revertReschedule', () => {
  it('restores the previous timetable when no log was created', async () => {
    const deleteLog = vi.fn()
    await expect(revertReschedule({ schedule: previous, logId: null }, deleteLog)).resolves.toEqual({
      schedule: previous,
      removedLog: false,
    })
    expect(deleteLog).not.toHaveBeenCalled()
  })

  it('deletes the "not held" log before handing back the previous timetable', async () => {
    const order = []
    const deleteLog = vi.fn(async (id) => order.push(`delete ${id}`))
    const result = await revertReschedule({ schedule: previous, logId: 'log-1' }, deleteLog)
    order.push('restore')

    expect(deleteLog).toHaveBeenCalledWith('log-1')
    expect(order).toEqual(['delete log-1', 'restore'])
    expect(result).toEqual({ schedule: previous, removedLog: true })
  })

  it('treats a log that is already gone (404) as removed', async () => {
    const deleteLog = vi.fn().mockRejectedValue(notFound())
    await expect(revertReschedule({ schedule: previous, logId: 'log-1' }, deleteLog)).resolves.toMatchObject({ removedLog: true })
  })

  it('fails without reverting anything when the log cannot be deleted', async () => {
    const deleteLog = vi.fn().mockRejectedValue(new Error('Could not save to browser storage.'))
    await expect(revertReschedule({ schedule: previous, logId: 'log-1' }, deleteLog)).rejects.toThrow('Could not save')
  })
})
