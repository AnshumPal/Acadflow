import { useCallback } from 'react'
import { getAcademicCalendar, saveAcademicCalendar } from '../api/syllabus'
import { useResource } from './useResource'

/** Semester window and holidays. `calendar` is null until loaded. */
export function useAcademicCalendar() {
  const { data: calendar, setData, loading, error } = useResource(getAcademicCalendar, null)

  const saveCalendar = useCallback(
    async (next) => {
      const saved = await saveAcademicCalendar(next)
      setData(saved)
      return saved
    },
    [setData],
  )

  return { calendar, loading, error, saveCalendar }
}
