import { AlertOctagon, AlertTriangle, CheckCircle2, ClipboardCheck, Info, ShieldCheck } from 'lucide-react'
import { reasonLabel } from '../../data/lectureStatus'
import { formatDate } from '../../utils/calendar'

const SEVERITY = {
  high: { icon: AlertOctagon, color: 'text-red-600', label: 'Critical' },
  medium: { icon: AlertTriangle, color: 'text-amber-600', label: 'Warning' },
  low: { icon: Info, color: 'text-blue-600', label: 'Suggestion' },
  info: { icon: Info, color: 'text-slate-400', label: 'Note' },
  ok: { icon: CheckCircle2, color: 'text-emerald-600', label: 'OK' },
}

/** Compliance findings for the section plus the most recent log activity. */
export default function AuditWidget({ flags, logs, onOpenLectureLog }) {
  // Newest edit first; logs saved together (bulk or sample) fall back to the latest lecture date.
  const recent = [...logs]
    .sort(
      (a, b) =>
        (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || b.date.localeCompare(a.date) || b.period - a.period,
    )
    .slice(0, 5)

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden /> Syllabus audit
      </h3>

      <ul className="mt-4 space-y-3">
        {flags.map((flag) => {
          const meta = SEVERITY[flag.severity] ?? SEVERITY.info
          const Icon = meta.icon
          return (
            <li key={flag.id} className="flex items-start gap-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} aria-label={meta.label} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">{flag.title}</p>
                <p className="text-xs text-slate-500">{flag.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500">Recent activity</p>
          <button
            type="button"
            onClick={onOpenLectureLog}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
          >
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden /> Open lecture log
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs italic text-slate-400">No lectures logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((log) => (
              <li key={log.id} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${log.status === 'conducted' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  aria-hidden
                />
                <span className="min-w-0 text-slate-600">
                  <span className="font-semibold text-slate-800">{log.course_name}</span> · {formatDate(log.date, { year: undefined })} ·{' '}
                  {log.status === 'conducted' ? 'conducted' : `not held (${reasonLabel(log.reason).toLowerCase()})`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
