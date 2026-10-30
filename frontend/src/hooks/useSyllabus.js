import { useCallback } from 'react'
import { deleteSyllabus, listSyllabi, saveSyllabus } from '../api/syllabus'
import { templateSyllabusFor } from '../data/sampleSyllabus'
import { useResource } from './useResource'

/**
 * Syllabus units for the courses of one section. A course uses the units its faculty saved,
 * else the bundled template for that course name, else none (progress then uses credits).
 */
export function useSyllabus(section) {
  const load = useCallback(() => (section ? listSyllabi(section) : Promise.resolve([])), [section])
  const { data: saved, setData, loading, error } = useResource(load, [])

  const syllabusFor = useCallback(
    (course) => {
      const own = saved.find((s) => s.course_id === course.id)
      if (own) return { units: own.units, source: 'custom' }
      const template = templateSyllabusFor(course.name)
      if (template) return { units: template, source: 'template' }
      return { units: [], source: 'none' }
    },
    [saved],
  )

  const saveCourseSyllabus = useCallback(
    async (course, units) => {
      const result = await saveSyllabus({ section, course_id: course.id, units })
      setData((prev) => [...prev.filter((s) => s.course_id !== course.id), result])
      return result
    },
    [section, setData],
  )

  const resetCourseSyllabus = useCallback(
    async (course) => {
      await deleteSyllabus(section, course.id)
      setData((prev) => prev.filter((s) => s.course_id !== course.id))
    },
    [section, setData],
  )

  return { syllabusFor, saveCourseSyllabus, resetCourseSyllabus, loading, error }
}
