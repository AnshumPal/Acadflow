import { AlertTriangle, BookOpen, CalendarClock, CheckCircle2, ChevronRight, CircleSlash, MapPin, Users } from 'lucide-react'
import Modal from './ui/Modal'
import { DAY_LABELS } from '../data/samplePayload'
import { BACKEND_CAPABILITIES } from '../api/config'
import { normalizeCourseName, periodLabel, periodTimeRange } from '../utils/schedule'

const TONES = {
  indigo: 'bg-indigo-100 text-indigo-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
}

function ActionButton({ icon: Icon, tone, title, detail, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden />
    </button>
  )
}

/** Opens when a class card is clicked: reschedule it, or log it in the lecture log. */
export default function ClassActionSheet({ open, cls, session, onClose, onReschedule, onLog }) {
  if (!open || !cls) return null

  const title = session?.title ?? normalizeCourseName(cls.course_name)
  const period = session?.period ?? cls.period
  const periods = session?.periods ?? 1
  const inCatalog = Boolean(session?.course)
  const labBlocked = Boolean(session?.isLab) && !BACKEND_CAPABILITIES.rescheduleLabBlocks

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={BookOpen}
      iconClassName="bg-blue-100 text-blue-700"
      title={title}
      description={`${DAY_LABELS[cls.day]} · ${periodLabel(period, periods)} (${periodTimeRange(period, periods)})`}
    >
      <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium">
          <MapPin className="h-3.5 w-3.5" aria-hidden /> {cls.room}
        </span>
        {cls.teachers?.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium">
            <Users className="h-3.5 w-3.5" aria-hidden /> {cls.teachers.join(', ')}
          </span>
        )}
      </div>

      {!inCatalog && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p>This class does not match a course in the catalog, so it cannot be rescheduled or logged.</p>
        </div>
      )}

      <div className="space-y-2">
        <ActionButton
          icon={CalendarClock}
          tone="indigo"
          title="Reschedule this class"
          detail={labBlocked ? 'Lab blocks cannot be moved yet' : 'Find a free period on another day'}
          disabled={!inCatalog || labBlocked}
          onClick={onReschedule}
        />
        <ActionButton
          icon={CheckCircle2}
          tone="emerald"
          title="Log as conducted"
          detail="Record the unit and topic covered"
          disabled={!inCatalog}
          onClick={() => onLog('conducted')}
        />
        <ActionButton
          icon={CircleSlash}
          tone="amber"
          title="Record as not held"
          detail="Faculty leave, holiday or institute event"
          disabled={!inCatalog}
          onClick={() => onLog('not_held')}
        />
      </div>
    </Modal>
  )
}
