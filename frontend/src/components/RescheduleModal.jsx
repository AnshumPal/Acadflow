import { useState } from 'react'
import { CalendarClock, Loader2, X } from 'lucide-react'
import { DAY_LABELS } from '../data/samplePayload'

export default function RescheduleModal({
  open,
  onClose,
  classLabel,
  numDays,
  onSubmit,
  loading,
}) {
  const [targetDay, setTargetDay] = useState(0)

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onSubmit(targetDay)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 shadow-2xl ring-1 ring-slate-900/[0.04]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Reschedule class</h2>
              <p className="text-sm text-slate-500">{classLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">New day</span>
            <select
              value={targetDay}
              onChange={(e) => setTargetDay(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
            >
              {DAY_LABELS.slice(0, numDays).map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-slate-500">
            The backend finds the first free period on that day with a matching room type.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
