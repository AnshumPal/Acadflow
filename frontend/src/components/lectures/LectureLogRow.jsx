import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, Trash2 } from 'lucide-react'
import { NOT_HELD_REASONS, SLOT_TYPE_LABELS } from '../../data/lectureStatus'
import { periodLabel, periodTimeRange } from '../../utils/schedule'
import { logForSession } from '../../utils/lectureLogs'
import { getErrorMessage } from '../../api/errors'

const toDraft = (log) => ({
  status: log?.status ?? '',
  unit_id: log?.unit_id ?? '',
  topic: log?.topic ?? '',
  reason: log?.reason ?? 'faculty_leave',
  remarks: log?.remarks ?? '',
})

function isDirty(draft, saved) {
  if (draft.status !== saved.status) return true
  if (draft.status === 'conducted') return draft.unit_id !== saved.unit_id || draft.topic.trim() !== saved.topic
  if (draft.status === 'not_held') return draft.reason !== saved.reason || draft.remarks.trim() !== saved.remarks
  return false
}

function StatusButton({ active, tone, icon: Icon, disabled, title, onClick, children }) {
  const activeTone =
    tone === 'emerald'
      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/15'
      : 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500/15'
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition sm:flex-none ${
        active ? activeTone : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </button>
  )
}

/**
 * One timetabled session on one date. Remount it (via `key`) when the saved log changes so the
 * form resets to what was saved.
 */
export default function LectureLogRow({
  section,
  session,
  date,
  existing,
  units,
  suggestedUnitId,
  preset,
  highlighted,
  isFuture,
  onSave,
  onDelete,
}) {
  const ref = useRef(null)
  const saved = toDraft(existing)
  const [draft, setDraft] = useState(() => {
    if (existing || !preset) return saved
    return { ...saved, status: preset, unit_id: preset === 'conducted' ? suggestedUnitId ?? '' : '' }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlighted])

  const inCatalog = Boolean(session.course_id)
  const conductedBlocked = isFuture && draft.status !== 'conducted'
  const futureConducted = isFuture && draft.status === 'conducted'
  const dirty = isDirty(draft, saved)
  const canSave = inCatalog && dirty && draft.status && !saving && !futureConducted

  const setStatus = (status) =>
    setDraft((d) => ({
      ...d,
      status,
      unit_id: status === 'conducted' && !d.unit_id ? suggestedUnitId ?? '' : d.unit_id,
    }))

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const conducted = draft.status === 'conducted'
      await onSave(
        logForSession({
          section,
          session,
          date,
          status: draft.status,
          unit_id: conducted ? draft.unit_id || null : null,
          topic: conducted ? draft.topic.trim() : '',
          reason: conducted ? null : draft.reason,
          remarks: conducted ? '' : draft.remarks.trim(),
        }),
        existing,
      )
    } catch (e) {
      setError(getErrorMessage(e))
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setError('')
    try {
      await onDelete(existing)
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  return (
    <li
      ref={ref}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
        highlighted ? 'border-blue-300 ring-2 ring-blue-500/25' : 'border-slate-200/80'
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex items-start gap-3 md:w-72 md:shrink-0">
          <span className="flex min-w-[3.5rem] flex-col items-center rounded-xl bg-slate-50 px-2 py-1.5 ring-1 ring-slate-200/70">
            <span className="text-sm font-bold tabular-nums text-slate-900">{periodLabel(session.period, session.periods)}</span>
            <span className="text-[10px] font-medium text-slate-400">{periodTimeRange(session.period, session.periods)}</span>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <p className="text-sm font-bold leading-snug text-slate-900">{session.title}</p>
              {session.isLab && (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">Lab</span>
              )}
              {session.slotType !== 'regular' && (
                <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-800">
                  {SLOT_TYPE_LABELS[session.slotType]}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {session.teachers.join(', ') || '—'} · {session.room}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold">
              {existing ? (
                <span className={existing.status === 'conducted' ? 'text-emerald-700' : 'text-amber-700'}>
                  {existing.status === 'conducted' ? 'Logged: conducted' : 'Logged: not held'}
                </span>
              ) : (
                <span className="text-slate-400">Not logged yet</span>
              )}
            </p>
          </div>
        </div>

        {inCatalog ? (
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex gap-2" role="group" aria-label={`Status of ${session.title}`}>
              <StatusButton
                tone="emerald"
                icon={CheckCircle2}
                active={draft.status === 'conducted'}
                disabled={conductedBlocked}
                title={conductedBlocked ? 'A lecture cannot be conducted on a future date' : undefined}
                onClick={() => setStatus('conducted')}
              >
                Conducted
              </StatusButton>
              <StatusButton tone="amber" icon={CircleSlash} active={draft.status === 'not_held'} onClick={() => setStatus('not_held')}>
                Not held
              </StatusButton>
            </div>

            {draft.status === 'conducted' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Syllabus unit</span>
                  <select
                    className="builder-input"
                    value={draft.unit_id}
                    onChange={(e) => setDraft((d) => ({ ...d, unit_id: e.target.value }))}
                  >
                    <option value="">{units.length ? 'No unit' : 'No syllabus units yet'}</option>
                    {units.map((u, i) => (
                      <option key={u.id} value={u.id}>
                        Unit {i + 1}: {u.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Topic covered</span>
                  <input
                    className="builder-input"
                    placeholder="e.g. Gradient descent"
                    maxLength={200}
                    value={draft.topic}
                    onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                  />
                </label>
              </div>
            )}

            {draft.status === 'not_held' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Reason</span>
                  <select
                    className="builder-input"
                    value={draft.reason}
                    onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
                  >
                    {NOT_HELD_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Remarks</span>
                  <input
                    className="builder-input"
                    placeholder="Optional"
                    maxLength={200}
                    value={draft.remarks}
                    onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
                  />
                </label>
              </div>
            )}

            {futureConducted && (
              <p className="text-[11px] text-red-600">This date is in the future, so the lecture cannot be marked as conducted yet.</p>
            )}
            {error && <p className="text-[11px] text-red-600">{error}</p>}

            {(draft.status || existing) && (
              <div className="flex items-center justify-end gap-2">
                {existing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove log
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {existing ? 'Update' : 'Save'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="flex flex-1 items-start gap-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            This class does not match a course in the catalog, so it cannot be logged.
          </p>
        )}
      </div>
    </li>
  )
}
