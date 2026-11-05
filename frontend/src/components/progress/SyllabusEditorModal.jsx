import { useId, useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Loader2, Plus, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import { newId } from '../../api/local/storage'
import { templateSyllabusFor } from '../../data/sampleSyllabus'
import { getErrorMessage } from '../../api/errors'

/**
 * Edits the units of one course's syllabus. Existing unit ids are kept, so lecture logs that
 * point at a unit stay attached to it after renaming or reordering.
 */
export default function SyllabusEditorModal({ course, syllabus, creditTarget, onClose, onSave, onReset }) {
  if (!course) return null
  return (
    <SyllabusEditor
      key={course.id}
      course={course}
      syllabus={syllabus}
      creditTarget={creditTarget}
      onClose={onClose}
      onSave={onSave}
      onReset={onReset}
    />
  )
}

function SyllabusEditor({ course, syllabus, creditTarget, onClose, onSave, onReset }) {
  const formId = useId()
  const [units, setUnits] = useState(() => syllabus.units.map((u) => ({ ...u })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = units.reduce((n, u) => n + (Number(u.planned_lectures) || 0), 0)
  const hasTemplate = Boolean(templateSyllabusFor(course.name))

  const update = (index, patch) => setUnits((list) => list.map((u, i) => (i === index ? { ...u, ...patch } : u)))
  const move = (index, delta) =>
    setUnits((list) => {
      const next = [...list]
      const [unit] = next.splice(index, 1)
      next.splice(index + delta, 0, unit)
      return next
    })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cleaned = units.map((u) => ({ ...u, title: u.title.trim(), planned_lectures: Number(u.planned_lectures) || 0 }))
    if (cleaned.some((u) => !u.title)) {
      setError('Every unit needs a title.')
      return
    }
    if (cleaned.some((u) => u.planned_lectures < 1)) {
      setError('Every unit needs at least 1 planned period.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(course, cleaned)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    setError('')
    try {
      await onReset(course)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      icon={BookOpen}
      iconClassName="bg-blue-100 text-blue-700"
      title="Edit syllabus"
      description={`${course.name} · ${course.section}`}
      footer={
        <>
          {syllabus.source === 'custom' && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 sm:mr-auto"
            >
              {hasTemplate ? 'Reset to template' : 'Remove units'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save syllabus
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">
          Planned counts are in periods (a lab session is 2). The credit scheme gives this course about{' '}
          <strong className="text-slate-700">{creditTarget} periods</strong> this semester; these units add up to{' '}
          <strong className="text-slate-700">{total}</strong>.
        </p>

        {units.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-6 text-center text-sm italic text-slate-500">
            No units yet. Progress uses the credit-based target until you add some.
          </p>
        )}

        <ol className="space-y-2">
          {units.map((unit, i) => (
            <li key={unit.id} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-2">
              <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400">{i + 1}</span>
              <input
                aria-label={`Unit ${i + 1} title`}
                className="builder-input min-w-0 flex-1"
                value={unit.title}
                maxLength={120}
                onChange={(e) => update(i, { title: e.target.value })}
                {...(i === 0 ? { 'data-autofocus': true } : {})}
              />
              <input
                aria-label={`Unit ${i + 1} planned periods`}
                type="number"
                min={1}
                max={99}
                className="builder-input w-16 shrink-0"
                value={unit.planned_lectures}
                onChange={(e) => update(i, { planned_lectures: e.target.value })}
              />
              <div className="flex shrink-0">
                <button
                  type="button"
                  aria-label={`Move unit ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move unit ${i + 1} down`}
                  disabled={i === units.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove unit ${i + 1}`}
                  onClick={() => setUnits((list) => list.filter((_, idx) => idx !== i))}
                  className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => setUnits((list) => [...list, { id: newId(), title: '', planned_lectures: 8 }])}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add unit
        </button>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}
