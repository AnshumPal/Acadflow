import { useId, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Loader2 } from 'lucide-react'
import Modal from './ui/Modal'
import { DAY_LABELS } from '../data/samplePayload'
import { NOT_HELD_REASONS } from '../data/lectureStatus'
import { BACKEND_CAPABILITIES } from '../api/config'
import { evaluateDay } from '../utils/slotAvailability'
import { periodLabel, periodTimeRange } from '../utils/schedule'
import { dayIndexOf, latestOccurrence } from '../utils/calendar'

const shortDay = (day) => (DAY_LABELS[day] ?? `Day ${day + 1}`).slice(0, 3)

// First day after the class's current day (wrapping round the week) that has a free period.
function defaultTargetDay(days, fromDay) {
  for (let i = 1; i <= days.length; i++) {
    const day = (fromDay + i) % days.length
    if (days[day]?.firstFree) return day
  }
  return fromDay < days.length ? fromDay : 0
}

function Notice({ children }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <p>{children}</p>
    </div>
  )
}

/**
 * Moves a class to another day. `context` = { cls, course, session, baseSchedule } where
 * baseSchedule is the schedule with this class (both periods, for a lab) already taken out.
 */
export default function RescheduleModal({ open, context, ...rest }) {
  if (!open || !context) return null
  return <RescheduleDialog context={context} {...rest} />
}

function RescheduleDialog({ context, section, rooms, numDays, numPeriods, loading, onClose, onSubmit }) {
  const { cls, course, session } = context
  const formId = useId()
  const isLab = Boolean(session?.isLab)
  const span = isLab ? 2 : 1
  const labBlocked = isLab && !BACKEND_CAPABILITIES.rescheduleLabBlocks
  const canPickPeriod = BACKEND_CAPABILITIES.reschedulePeriodPick && !labBlocked

  const days = useMemo(() => {
    if (!course) return []
    return Array.from({ length: numDays }, (_, day) =>
      evaluateDay({ schedule: context.baseSchedule, section, course, day, rooms, numPeriods, span }),
    )
  }, [context.baseSchedule, section, course, rooms, numDays, numPeriods, span])

  const [targetDay, setTargetDay] = useState(() => defaultTargetDay(days, cls.day))
  const [pickedPeriod, setPickedPeriod] = useState(null)
  const [recordMissed, setRecordMissed] = useState(false)
  const [missedDate, setMissedDate] = useState(() => latestOccurrence(cls.day))
  const [missedReason, setMissedReason] = useState('faculty_leave')

  const evaluation = days[targetDay]
  const picked = canPickPeriod && pickedPeriod ? evaluation?.periods.find((p) => p.period === pickedPeriod && p.free) : null
  const landing = picked ?? evaluation?.firstFree ?? null

  let blockedReason = null
  if (!course) {
    blockedReason = 'This slot does not match a course in the catalog, so it cannot be rescheduled. Check the course name in Configuration & Data.'
  } else if (labBlocked) {
    blockedReason = 'Lab blocks cannot be moved yet: the backend places only one of the two periods. Use "Add slot" on an empty cell for an extra lab instead.'
  } else if (!landing) {
    blockedReason = `No free ${isLab ? 'lab block' : 'period'} on ${DAY_LABELS[targetDay]}: the section, a teacher or every matching room is busy all day.`
  }

  const missedDateWrongDay = recordMissed && missedDate && dayIndexOf(missedDate) !== cls.day
  const canApply = !blockedReason && !loading && (!recordMissed || (missedDate && !missedDateWrongDay))

  const selectDay = (day) => {
    setTargetDay(day)
    setPickedPeriod(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canApply) return
    onSubmit({
      targetDay,
      targetPeriod: canPickPeriod ? landing.period : undefined,
      missed: recordMissed ? { date: missedDate, reason: missedReason } : null,
    })
  }

  const currentPeriod = session?.period ?? cls.period
  const currentSpan = session?.periods ?? 1

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!loading}
      size="lg"
      icon={CalendarClock}
      title="Reschedule class"
      description={`${session?.title ?? cls.course_name} · ${section}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!canApply}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {landing && !blockedReason ? `Move to ${shortDay(targetDay)} · ${periodLabel(landing.period, span)}` : 'Apply'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Currently</span>
          <span>
            {DAY_LABELS[cls.day]} · {periodLabel(currentPeriod, currentSpan)} ({periodTimeRange(currentPeriod, currentSpan)})
          </span>
          <span className="text-slate-300">·</span>
          <span>{cls.room}</span>
          {cls.teachers?.length > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span>{cls.teachers.join(', ')}</span>
            </>
          )}
        </div>

        {days.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Move to</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {days.map(({ day, periods, firstFree }) => {
                const selected = day === targetDay
                const freeCount = periods.filter((p) => p.free).length
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectDay(day)}
                    className={`flex flex-col items-center rounded-xl border px-2 py-2 transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20'
                        : firstFree
                        ? 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}
                  >
                    <span className="text-sm font-semibold">{shortDay(day)}</span>
                    <span className={`mt-0.5 text-[10px] font-medium ${firstFree ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {firstFree ? `${freeCount} free` : 'Full'}
                    </span>
                    {day === cls.day && (
                      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">current</span>
                    )}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {evaluation && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">{DAY_LABELS[targetDay]}</p>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80">
              {evaluation.periods.map((slot) => {
                const isLanding = !blockedReason && landing?.period === slot.period
                const content = (
                  <>
                    <span className="w-16 shrink-0">
                      <span className="block font-bold text-slate-800">{periodLabel(slot.period, span)}</span>
                      <span className="block text-[10px] text-slate-400">{periodTimeRange(slot.period, span)}</span>
                    </span>
                    <span className={`min-w-0 flex-1 ${slot.free ? 'text-slate-700' : 'text-slate-400'}`}>
                      {slot.free
                        ? `Free · ${slot.room}${slot.rooms.length > 1 ? ` (+${slot.rooms.length - 1} more)` : ''}`
                        : slot.reason}
                    </span>
                    {isLanding && (
                      <span className="shrink-0 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        Lands here
                      </span>
                    )}
                  </>
                )
                const rowClass = `flex w-full items-center gap-3 px-3 py-2 text-left text-xs ${
                  isLanding ? 'bg-indigo-50' : slot.free ? 'bg-white' : 'bg-slate-50/60'
                }`
                return (
                  <li key={slot.period}>
                    {canPickPeriod && slot.free ? (
                      <button
                        type="button"
                        aria-pressed={isLanding}
                        onClick={() => setPickedPeriod(slot.period)}
                        className={`${rowClass} hover:bg-indigo-50/60`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className={rowClass}>{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            {!canPickPeriod && !blockedReason && (
              <p className="mt-2 text-xs text-slate-500">
                The backend takes the first free period on the chosen day, so that is where the class lands.
              </p>
            )}
          </div>
        )}

        {blockedReason && <Notice>{blockedReason}</Notice>}

        {course && !labBlocked && (
          <div className="rounded-2xl border border-slate-200/80 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={recordMissed}
                onChange={(e) => setRecordMissed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-indigo-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">Also record the missed lecture</span>
                <span className="block text-xs text-slate-500">
                  Adds a “not held” entry to the lecture log so the syllabus audit counts it.
                </span>
              </span>
            </label>
            {recordMissed && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Date missed</span>
                  <input
                    type="date"
                    required
                    value={missedDate}
                    onChange={(e) => setMissedDate(e.target.value)}
                    className="builder-input"
                    aria-invalid={missedDateWrongDay || undefined}
                  />
                  {missedDateWrongDay && (
                    <span className="mt-1 block text-[11px] text-red-600">
                      Pick a {DAY_LABELS[cls.day]}: that is when this class runs.
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Reason</span>
                  <select value={missedReason} onChange={(e) => setMissedReason(e.target.value)} className="builder-input">
                    {NOT_HELD_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
