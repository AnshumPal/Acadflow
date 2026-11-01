import { useCallback } from 'react'
import {
  createLectureLog,
  createLectureLogs,
  deleteLectureLog,
  listLectureLogs,
  updateLectureLog,
} from '../api/lectures'
import { compareLogs } from '../utils/lectureLogs'
import { useResource } from './useResource'

/**
 * All lecture logs of one section, plus mutations that keep the list in sync.
 * Bump `revision` to reload after logs were changed elsewhere (e.g. by Undo on the toast).
 */
export function useLectureLogs(section, revision = 0) {
  const load = useCallback(
    () => (section ? listLectureLogs({ section }) : Promise.resolve([])),
    [section, revision], // `revision` is not read; changing it just forces a reload

  )
  const { data: logs, setData: setLogs, loading, error, reload } = useResource(load, [])

  const merge = useCallback(
    (saved) => setLogs((prev) => [...prev.filter((l) => !saved.some((s) => s.id === l.id)), ...saved].sort(compareLogs)),
    [setLogs],
  )

  /** Creates `log`, or updates `existing` with it. Returns the saved log. */
  const saveLog = useCallback(
    async (log, existing) => {
      const saved = existing ? await updateLectureLog(existing.id, log) : await createLectureLog(log)
      merge([saved])
      return saved
    },
    [merge],
  )

  const addLogs = useCallback(
    async (list) => {
      const saved = await createLectureLogs(list)
      merge(saved)
      return saved
    },
    [merge],
  )

  const removeLog = useCallback(
    async (id) => {
      await deleteLectureLog(id)
      setLogs((prev) => prev.filter((l) => l.id !== id))
    },
    [setLogs],
  )

  return { logs, loading, error, reload, saveLog, addLogs, removeLog }
}
