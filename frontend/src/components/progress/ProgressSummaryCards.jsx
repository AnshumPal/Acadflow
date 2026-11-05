import ProgressMeter from './ProgressMeter'
import { STATUS_META, percent } from './statusMeta'

function Tile({ label, children, footer }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-2 flex-1">{children}</div>
      {footer && <p className="mt-3 text-xs text-slate-500">{footer}</p>}
    </div>
  )
}

/** KPI row: overall completion (the one hero figure), pace, lost lectures, courses needing attention. */
export default function ProgressSummaryCards({ progress }) {
  const { totals, statusCounts, courses } = progress
  const sectionStatus = totals.status
  const paceMeta = STATUS_META[sectionStatus]
  const PaceIcon = paceMeta.icon
  const attention = (statusCounts.behind ?? 0) + (statusCounts.at_risk ?? 0)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Syllabus completed" footer={`${totals.conducted} of ${totals.target} planned periods conducted`}>
        <p className="text-5xl font-semibold leading-none text-slate-900">{percent(totals.completion)}</p>
        <div className="mt-4">
          <ProgressMeter
            label="Section syllabus completion"
            conducted={totals.conducted}
            expected={totals.expected}
            target={totals.target}
            status={sectionStatus}
            size="lg"
          />
        </div>
      </Tile>

      <Tile label="Pace against plan" footer={`${totals.expected} periods expected by today`}>
        <p className="text-3xl font-semibold text-slate-900">{totals.target ? percent(totals.pace) : '—'}</p>
        <p className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold ${paceMeta.iconColor}`}>
          <PaceIcon className="h-4 w-4" aria-hidden />
          <span className="text-slate-700">{paceMeta.label}</span>
        </p>
      </Tile>

      <Tile
        label="Lectures not held"
        footer={
          totals.notHeld === 0
            ? 'No lost periods so far'
            : `${totals.compensated} made up with extra classes, ${totals.uncompensated} still owed`
        }
      >
        <p className="text-3xl font-semibold text-slate-900">{totals.notHeld}</p>
        <p className="mt-2 text-sm text-slate-500">periods</p>
      </Tile>

      <Tile
        label="Courses needing attention"
        footer={totals.unlogged ? `${totals.unlogged} past periods have no log yet` : 'Every past period is logged'}
      >
        <p className="text-3xl font-semibold text-slate-900">
          {attention} <span className="text-base font-medium text-slate-400">of {courses.length}</span>
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {statusCounts.behind ?? 0} behind · {statusCounts.at_risk ?? 0} at risk
        </p>
      </Tile>
    </div>
  )
}
