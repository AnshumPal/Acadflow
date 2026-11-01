import { api } from './http'
import { DATA_SOURCE } from './config'
import { readJson, writeJson } from './local/storage'
import { DEFAULT_CALENDAR } from '../data/academicCalendar'

/**
 * CourseSyllabus   { section, course_id, units: [{ id, title, planned_lectures }], updated_at }
 * AcademicCalendar { semester_start: 'YYYY-MM-DD', semester_end: 'YYYY-MM-DD', holidays: [{ date, label }] }
 */

const SYLLABUS_KEY = 'acadflow_syllabus_v1'
const CALENDAR_KEY = 'acadflow_calendar_v1'

export function normalizeCalendar(value) {
  if (!value || typeof value !== 'object' || !value.semester_start || !value.semester_end) {
    return { ...DEFAULT_CALENDAR, holidays: DEFAULT_CALENDAR.holidays.map((h) => ({ ...h })) }
  }
  const holidays = Array.isArray(value.holidays) ? value.holidays : []
  return {
    semester_start: value.semester_start,
    semester_end: value.semester_end,
    holidays: holidays
      .filter((h) => h && h.date)
      .map((h) => ({ date: h.date, label: h.label || 'Holiday' }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  }
}

function readSyllabi() {
  const all = readJson(SYLLABUS_KEY, [])
  return Array.isArray(all) ? all : []
}

const isSameCourse = (s, section, courseId) => s.section === section && s.course_id === courseId

const localSource = {
  async listSyllabi(section) {
    return readSyllabi().filter((s) => !section || s.section === section)
  },
  async saveSyllabus(syllabus) {
    const others = readSyllabi().filter((s) => !isSameCourse(s, syllabus.section, syllabus.course_id))
    const saved = { ...syllabus, updated_at: new Date().toISOString() }
    writeJson(SYLLABUS_KEY, [...others, saved])
    return saved
  },
  async deleteSyllabus(section, courseId) {
    writeJson(SYLLABUS_KEY, readSyllabi().filter((s) => !isSameCourse(s, section, courseId)))
  },
  async getCalendar() {
    return normalizeCalendar(readJson(CALENDAR_KEY, null))
  },
  async saveCalendar(calendar) {
    const saved = normalizeCalendar(calendar)
    writeJson(CALENDAR_KEY, saved)
    return saved
  },
}

const remoteSource = {
  async listSyllabi(section) {
    const { data } = await api.get('/api/v1/syllabus', { params: { section } })
    return data.items ?? []
  },
  async saveSyllabus(syllabus) {
    const { data } = await api.put(`/api/v1/syllabus/${encodeURIComponent(syllabus.course_id)}`, syllabus)
    return data
  },
  async deleteSyllabus(section, courseId) {
    await api.delete(`/api/v1/syllabus/${encodeURIComponent(courseId)}`, { params: { section } })
  },
  async getCalendar() {
    const { data } = await api.get('/api/v1/calendar')
    return normalizeCalendar(data)
  },
  async saveCalendar(calendar) {
    const { data } = await api.put('/api/v1/calendar', normalizeCalendar(calendar))
    return normalizeCalendar(data)
  },
}

const source = DATA_SOURCE === 'remote' ? remoteSource : localSource

export const listSyllabi = (section) => source.listSyllabi(section)
export const saveSyllabus = (syllabus) => source.saveSyllabus(syllabus)
export const deleteSyllabus = (section, courseId) => source.deleteSyllabus(section, courseId)
export const getAcademicCalendar = () => source.getCalendar()
export const saveAcademicCalendar = (calendar) => source.saveCalendar(calendar)
