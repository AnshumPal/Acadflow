import { DAY_LABELS } from '../data/samplePayload'

const PERIOD_TIMES = [
  '9–10',
  '10–11',
  '11–12',
  '12–1',
  '1–2',
  '2–3',
  '3–4',
  '4–5',
]

function slotClasses(sectionClasses, day, period) {
  return sectionClasses.filter((c) => c.day === day && c.period === period)
}

function classTitleAndBadges(courseName) {
  const extra = /\s*\(Extra\)\s*$/i.test(courseName)
  const rescheduled = /\s*\(Rescheduled\)\s*$/i.test(courseName)
  const title = courseName
    .replace(/\s*\(Extra\)\s*$/i, '')
    .replace(/\s*\(Rescheduled\)\s*$/i, '')
    .trim()
  return { title, extra, rescheduled }
}

function slotAccent(cls) {
  if (cls.is_recess) return 'amber'
  const lab =
    cls.room?.toLowerCase().includes('lab') || /\bLAB\b/i.test(cls.course_name || '')
  const extra = /\s*\(Extra\)\s*$/i.test(cls.course_name || '')
  if (extra) return 'violet'
  if (lab) return 'emerald'
  return 'blue'
}

const ACCENT_BORDER = {
  blue: 'border-l-blue-500',
  violet: 'border-l-violet-500',
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
}

function OrDivider() {
  return (
    <div className="my-1.5 flex items-center gap-2 px-0.5">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">or</span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    </div>
  )
}

function ClassCard({ cls, onClassClick }) {
  if (cls.is_recess) {
    return (
      <div className="w-full rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/80 px-2.5 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-amber-900 shadow-sm">
        Recess
      </div>
    )
  }

  const { title, extra, rescheduled } = classTitleAndBadges(cls.course_name)
  const accent = slotAccent(cls)

  return (
    <button
      type="button"
      onClick={() => onClassClick(cls)}
      className={`group w-full rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/90 px-2.5 py-2 text-left shadow-sm ring-1 ring-slate-900/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200/80 hover:shadow-md hover:ring-blue-500/10 ${ACCENT_BORDER[accent]} border-l-[3px]`}
    >
      <div className="flex flex-wrap items-center gap-1">
        <p className="text-[11px] font-bold leading-snug text-slate-900 group-hover:text-blue-950">{title}</p>
        {extra && (
          <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-800">
            Extra
          </span>
        )}
        {rescheduled && (
          <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-sky-800">
            Moved
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] font-medium text-slate-600">{cls.teachers?.join(', ') || '—'}</p>
      <span className="mt-1.5 inline-flex items-center rounded-md bg-slate-900/[0.04] px-2 py-0.5 text-[9px] font-semibold text-slate-700">
        {cls.room}
      </span>
    </button>
  )
}

export default function TimetableGrid({
  sectionClasses,
  numDays,
  numPeriods,
  onEmptySlot,
  onClassClick,
}) {
  const periods = Array.from({ length: numPeriods }, (_, i) => i + 1)
  const days = Array.from({ length: numDays }, (_, i) => i)

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-soft ring-1 ring-slate-900/[0.03]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-blue-50/30 px-5 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-slate-900">Weekly matrix</h3>
        <p className="mt-0.5 text-xs text-slate-500">Rows are days · columns are periods · parallel electives stack with “or”</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/90">
              <th className="sticky left-0 z-20 w-[7.5rem] border-b border-r border-slate-200/80 bg-slate-50/95 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-sm">
                Day
              </th>
              {periods.map((p) => (
                <th
                  key={p}
                  className="border-b border-slate-200/80 px-1.5 py-3 text-center"
                >
                  <span className="inline-flex min-w-[2.75rem] flex-col items-center gap-0.5 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-200/60">
                    <span className="text-sm font-bold tabular-nums text-slate-900">{p}</span>
                    <span className="text-[9px] font-medium text-slate-400">
                      {PERIOD_TIMES[p - 1] ?? '—'}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d} className="transition-colors hover:bg-slate-50/40">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200/70 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 text-left text-xs font-bold text-slate-800 backdrop-blur-sm">
                  {DAY_LABELS[d] ?? `Day ${d}`}
                </th>
                {periods.map((p) => {
                  const items = slotClasses(sectionClasses, d, p)
                  const teaching = items.filter((c) => !c.is_recess)
                  const recessOnly = items.length > 0 && teaching.length === 0

                  return (
                    <td
                      key={`${d}-${p}`}
                      className={`align-top border-b border-l border-slate-100 p-2 transition-colors ${
                        recessOnly ? 'bg-amber-50/40' : 'bg-white/40'
                      }`}
                    >
                      {items.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => onEmptySlot(d, p)}
                          className="group flex min-h-[5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200/90 bg-slate-50/30 text-[10px] font-semibold text-slate-400 transition-all duration-200 hover:border-blue-300/80 hover:bg-gradient-to-br hover:from-blue-50/80 hover:to-indigo-50/50 hover:text-blue-700"
                        >
                          <span className="text-lg font-light leading-none text-slate-300 transition-colors group-hover:text-blue-500">
                            +
                          </span>
                          Add slot
                        </button>
                      ) : (
                        <div className="flex min-h-[5rem] flex-col gap-1">
                          {teaching.map((cls, idx) => (
                            <div key={`${cls.course_name}-${cls.room}-${idx}`}>
                              {idx > 0 && <OrDivider />}
                              <ClassCard cls={cls} onClassClick={onClassClick} />
                            </div>
                          ))}
                          {items.some((c) => c.is_recess) && (
                            <>
                              {teaching.length > 0 && <OrDivider />}
                              {items
                                .filter((c) => c.is_recess)
                                .map((cls, idx) => (
                                  <ClassCard key={`recess-${idx}`} cls={cls} onClassClick={() => {}} />
                                ))}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
