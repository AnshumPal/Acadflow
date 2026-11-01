import { STATUS_META } from './statusMeta'

/**
 * Horizontal meter: the fill is periods conducted against the target, coloured by status;
 * the dark tick marks where the course should be by today.
 */
export default function ProgressMeter({ conducted, expected, target, status, label, size = 'md' }) {
  const meta = STATUS_META[status] ?? STATUS_META.no_plan
  const fill = target > 0 ? Math.min(100, (conducted / target) * 100) : 0
  const tick = target > 0 ? Math.min(100, (expected / target) * 100) : 0
  const height = size === 'lg' ? 'h-3' : 'h-2'

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(conducted, target)}
      aria-valuetext={`${conducted} of ${target} periods conducted, ${expected} expected by today`}
      title={`${conducted} of ${target} periods conducted · ${expected} expected by today`}
      className={`relative w-full rounded-full ${height} ${meta.track}`}
    >
      <div className={`absolute inset-y-0 left-0 rounded-full ${meta.fill}`} style={{ width: `${fill}%` }} />
      {target > 0 && expected > 0 && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-slate-800 ring-2 ring-white"
          style={{ left: `${tick}%` }}
          aria-hidden
        />
      )}
    </div>
  )
}
