import { api } from './http'
import { DATA_SOURCE } from './config'
import { readJson, writeJson, newId } from './local/storage'
import { compareLogs } from '../utils/lectureLogs'

/**
 * LectureLog {
 *   id, section, course_id, course_name, date: 'YYYY-MM-DD', day, period, periods, room, teachers,
 *   slot_type: 'regular' | 'extra' | 'rescheduled',
 *   status: 'conducted' | 'not_held',
 *   unit_id?, topic?, reason?, remarks?, created_at, updated_at
 * }
 * At most one log per (section, course_id, date, period).
 */

const LOGS_KEY = 'acadflow_lectures_v1'

const sameSlot = (a, b) =>
  a.section === b.section && a.course_id === b.course_id && a.date === b.date && a.period === b.period

const duplicateError = (log) =>
  new Error(`${log.course_name} on ${log.date} (period ${log.period}) is already logged.`)

function matchesFilter(log, { section, course_id, from, to, status } = {}) {
  if (section && log.section !== section) return false
  if (course_id && log.course_id !== course_id) return false
  if (status && log.status !== status) return false
  if (from && log.date < from) return false
  if (to && log.date > to) return false
  return true
}

function readLogs() {
  const logs = readJson(LOGS_KEY, [])
  return Array.isArray(logs) ? logs : []
}

const localSource = {
  async list(filter) {
    return readLogs().filter((log) => matchesFilter(log, filter)).sort(compareLogs)
  },
  async createMany(list) {
    const all = readLogs()
    const now = new Date().toISOString()
    const saved = list.map((log) => {
      if (all.some((existing) => sameSlot(existing, log))) throw duplicateError(log)
      const entry = { ...log, id: newId(), created_at: now, updated_at: now }
      all.push(entry)
      return entry
    })
    writeJson(LOGS_KEY, all) // single write: either every log is saved or none is
    return saved
  },
  async create(log) {
    const [saved] = await localSource.createMany([log])
    return saved
  },
  async update(id, patch) {
    const all = readLogs()
    const idx = all.findIndex((log) => log.id === id)
    if (idx === -1) throw new Error('This log no longer exists. Reload the page and try again.')
    const updated = {
      ...all[idx],
      ...patch,
      id,
      created_at: all[idx].created_at,
      updated_at: new Date().toISOString(),
    }
    if (all.some((log, i) => i !== idx && sameSlot(log, updated))) throw duplicateError(updated)
    all[idx] = updated
    writeJson(LOGS_KEY, all)
    return updated
  },
  async remove(id) {
    writeJson(LOGS_KEY, readLogs().filter((log) => log.id !== id))
  },
}

const remoteSource = {
  async list(filter) {
    const { data } = await api.get('/api/v1/lectures', { params: filter })
    return data.items ?? []
  },
  async create(log) {
    const { data } = await api.post('/api/v1/lectures', log)
    return data
  },
  async createMany(list) {
    const saved = []
    for (const log of list) saved.push(await remoteSource.create(log))
    return saved
  },
  async update(id, patch) {
    const { data } = await api.patch(`/api/v1/lectures/${encodeURIComponent(id)}`, patch)
    return data
  },
  async remove(id) {
    await api.delete(`/api/v1/lectures/${encodeURIComponent(id)}`)
  },
}

const source = DATA_SOURCE === 'remote' ? remoteSource : localSource

export const listLectureLogs = (filter) => source.list(filter)
export const createLectureLog = (log) => source.create(log)
export const createLectureLogs = (logs) => source.createMany(logs)
export const updateLectureLog = (id, patch) => source.update(id, patch)
export const deleteLectureLog = (id) => source.remove(id)
