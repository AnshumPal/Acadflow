import { useMemo, useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import { reasonLabel } from '../../data/lectureStatus'
import { formatDate } from '../../utils/calendar'
import { periodLabel } from '../../utils/schedule'

const PAGE_SIZE = 20

/** Every log of the section, newest first, with course and status filters. */
export default function LectureHistoryTable({ logs, courses, syllabusFor, onOpenDate, onDelete }) {
  const [courseId, setCourseId] = useState('')
  const [status, setStatus] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const unitTitles = useMemo(() => {
    const titles = new Map()
    for (const course of courses) {
      syllabusFor(course).units.forEach((u, i) => titles.set(`${course.id}|${u.id}`, `Unit ${i + 1}: ${u.title}`))
    }
    return titles
  }, [courses, syllabusFor])

  const filtered = useMemo(
    () =>
      logs
        .filter((l) => (!courseId || l.course_id === courseId) && (!status || l.status === status))
        .sort((a, b) => (a.date === b.date ? b.period - a.period : a.date < b.date ? 1 : -1)),
    [logs, courseId, status],
  )

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xl sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4 text-slate-400" aria-hidden /> Log history
          <span className="font-normal text-slate-400">({filtered.length})</span>
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select
            aria-label="Filter by course"
            className="builder-input sm:w-56"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value)
              setVisible(PAGE_SIZE)
            }}
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            className="builder-input sm:w-36"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setVisible(PAGE_SIZE)
            }}
          >
            <option value="">All statuses</option>
            <option value="conducted">Conducted</option>
            <option value="not_held">Not held</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm italic text-slate-500">
          No lectures logged yet.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80">
            {filtered.slice(0, visible).map((log) => (
              <li
                key={log.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-xs md:grid-cols-[9rem_4.5rem_minmax(0,1.3fr)_6rem_minmax(0,1.5fr)_auto]"
              >
                <button
                  type="button"
                  onClick={() => onOpenDate(log.date)}
                  className="text-left font-semibold text-blue-700 hover:underline"
                  title="Open this day"
                >
                  {formatDate(log.date)}
                </button>
                <span className="hidden font-semibold tabular-nums text-slate-600 md:block">{periodLabel(log.period, log.periods)}</span>
                <span className="col-span-2 min-w-0 truncate font-semibold text-slate-800 md:col-span-1">
                  <span className="md:hidden">{periodLabel(log.period, log.periods)} · </span>
                  {log.course_name}
                </span>
                <span
                  className={`w-fit rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    log.status === 'conducted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {log.status === 'conducted' ? 'Conducted' : 'Not held'}
                </span>
                <span className="col-span-2 min-w-0 truncate text-slate-500 md:col-span-1">
                  {log.status === 'conducted'
                    ? [unitTitles.get(`${log.course_id}|${log.unit_id}`), log.topic].filter(Boolean).join(' · ') || '—'
                    : [reasonLabel(log.reason), log.remarks].filter(Boolean).join(' · ')}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(log)}
                  aria-label={`Remove log for ${log.course_name} on ${log.date}`}
                  className="row-start-1 justify-self-end rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 md:row-start-auto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {visible < filtered.length && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
            </button>
          )}
        </>
      )}
    </section>
  )
}
