// Compatibility entry point: existing `import … from './api/client'` statements keep working.
// New code can import from the specific modules (timetable, lectures, syllabus).
export { api, setAuthTokenProvider } from './http'
export { generateTimetable, exportExcel, scheduleExtra, rescheduleDynamic } from './timetable'
export { getErrorMessage } from './errors'
