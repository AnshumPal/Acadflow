import { BookOpen, Pencil } from 'lucide-react'
import ProgressMeter from './ProgressMeter'
import { STATUS_SEVERITY, StatusPill, percent } from './statusMeta'

const TARGET_SOURCE_LABEL = {
  custom: 'Faculty syllabus',
  template: 'Template syllabus',
  credits: 'Credit-based target',
}

/** One row per course, courses needing attention first. */
export default function CourseProgressList({ rows, onEditSyllabus }) {
  const sorted = [...rows].sort(
    (a, b) => STATUS_SEVERITY[a.status] - STATUS_SEVERITY[b.status] || a.pace - b.pace || a.course.name.localeCompare(b.course.name),
  )

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white shadow-xl">
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-blue-50/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Course progress</h3>
          <p className="mt-0.5 text-xs text-slate-500">Courses that need attention are listed first</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" /> Conducted (colour = status)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded-full bg-slate-800" /> Expected by today
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm italic text-slate-500">This section has no courses in the catalog.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((row) => {
            const { course } = row
            return (
              <li
                key={course.id}
                className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto] lg:items-center lg:gap-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-900">{course.name}</p>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                      {course.is_lab ? 'Lab' : 'Theory'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{course.teachers.join(', ')}</p>
                </div>

                <div className="min-w-0">
                  <ProgressMeter
                    label={`${course.name} progress`}
                    conducted={row.conducted}
                    expected={row.expected}
                    target={row.target}
                    status={row.status}
                  />
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-700">
                      <span className="font-semibold">
                        {row.conducted}/{row.target}
                      </span>{' '}
                      periods ({percent(row.completion)}) · expected {row.expected}
                    </span>
                    <span className="text-slate-400">{TARGET_SOURCE_LABEL[row.targetSource]}</span>
                  </div>
                  {row.units.length > 0 && (
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      {row.unitsDone}/{row.units.length} units done
                      {row.currentUnit && row.unitsDone < row.units.length && (
                        <span className="truncate"> · now: {row.currentUnit.title}</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 lg:justify-end">
                  <StatusPill status={row.status} />
                  <button
                    type="button"
                    onClick={() => onEditSyllabus(course)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Syllabus
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
