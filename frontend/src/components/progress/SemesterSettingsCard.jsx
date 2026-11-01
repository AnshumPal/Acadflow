import { useState } from 'react'
import { CalendarRange, Loader2, Plus, X } from 'lucide-react'
import { formatDate, teachingDates } from '../../utils/calendar'
import { getErrorMessage } from '../../api/errors'

function validate(draft) {
  if (!draft.semester_start || !draft.semester_end) return 'Enter both semester dates.'
  if (draft.semester_start >= draft.semester_end) return 'The semester must end after it starts.'
  const outside = draft.holidays.find((h) => h.date < draft.semester_start || h.date > draft.semester_end)
  if (outside) return `${outside.label || 'A holiday'} (${outside.date}) is outside the semester.`
  return ''
}

/** Semester window and holidays: the basis for "expected by today". */
export default function SemesterSettingsCard({ calendar, numDays, onSave, onNotify }) {
  const [draft, setDraft] = useState(null) // null = not editing
  const [newHoliday, setNewHoliday] = useState({ date: '', label: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const startEditing = () => {
    setDraft({ ...calendar, holidays: calendar.holidays.map((h) => ({ ...h })) })
    setError('')
  }

  const addHoliday = () => {
    if (!newHoliday.date) return
    setDraft((d) => ({
      ...d,
      holidays: [...d.holidays.filter((h) => h.date !== newHoliday.date), { date: newHoliday.date, label: newHoliday.label.trim() || 'Holiday' }].sort(
        (a, b) => (a.date < b.date ? -1 : 1),
      ),
    }))
    setNewHoliday({ date: '', label: '' })
  }

  const handleSave = async () => {
    const problem = validate(draft)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(draft)
      setDraft(null)
      onNotify('Semester calendar saved.')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const teachingDayCount = teachingDates(calendar, numDays).length

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarRange className="h-4 w-4 text-blue-600" aria-hidden /> Semester calendar
        </h3>
        {!draft && (
          <button type="button" onClick={startEditing} className="text-xs font-semibold text-blue-700 hover:underline">
            Edit
          </button>
        )}
      </div>

      {!draft ? (
        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Runs</dt>
            <dd className="text-right font-medium text-slate-800">
              {formatDate(calendar.semester_start)} – {formatDate(calendar.semester_end)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Teaching days</dt>
            <dd className="font-medium text-slate-800">{teachingDayCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Holidays</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {calendar.holidays.length === 0 && <span className="text-slate-400">None</span>}
              {calendar.holidays.map((h) => (
                <span key={h.date} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                  {h.label} · {formatDate(h.date, { weekday: undefined, year: undefined })}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Starts</span>
              <input
                type="date"
                className="builder-input"
                value={draft.semester_start}
                onChange={(e) => setDraft((d) => ({ ...d, semester_start: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Ends</span>
              <input
                type="date"
                className="builder-input"
                value={draft.semester_end}
                onChange={(e) => setDraft((d) => ({ ...d, semester_end: e.target.value }))}
              />
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-slate-600">Holidays</p>
            <ul className="space-y-1.5">
              {draft.holidays.map((h) => (
                <li key={h.date} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                  <span className="text-slate-700">
                    {formatDate(h.date)} · {h.label}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${h.label}`}
                    onClick={() => setDraft((d) => ({ ...d, holidays: d.holidays.filter((x) => x.date !== h.date) }))}
                    className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <input
                type="date"
                aria-label="Holiday date"
                className="builder-input"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))}
              />
              <input
                aria-label="Holiday name"
                placeholder="Name"
                className="builder-input"
                value={newHoliday.label}
                onChange={(e) => setNewHoliday((h) => ({ ...h, label: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addHoliday()
                  }
                }}
              />
              <button
                type="button"
                onClick={addHoliday}
                disabled={!newHoliday.date}
                aria-label="Add holiday"
                className="rounded-lg bg-slate-100 px-2.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saving}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Save calendar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
