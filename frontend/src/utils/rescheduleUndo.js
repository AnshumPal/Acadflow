/**
 * Reverts a reschedule recorded as `undo = { schedule, logId }`: `schedule` is the timetable from
 * before the move, `logId` the "not held" log created with it (or null).
 *
 * The log is deleted first and the previous timetable is returned only if that worked, so a
 * failure leaves both the timetable and the log as they are — still consistent with each other —
 * and the caller can offer Undo again. A log that is already gone (404) counts as deleted.
 */
export async function revertReschedule(undo, deleteLog) {
  if (undo.logId) {
    try {
      await deleteLog(undo.logId)
    } catch (e) {
      if (e?.response?.status !== 404) throw e
    }
  }
  return { schedule: undo.schedule, removedLog: Boolean(undo.logId) }
}
