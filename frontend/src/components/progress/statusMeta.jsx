import { AlertOctagon, AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react'

// Status colours are reserved for state and always ship with an icon and a label.
// `track` is a lighter step of the same hue so a meter reads as one state end to end.
export const STATUS_META = {
  on_track: {
    label: 'On track',
    icon: CheckCircle2,
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    iconColor: 'text-emerald-600',
    fill: 'bg-emerald-500',
    track: 'bg-emerald-100',
  },
  at_risk: {
    label: 'At risk',
    icon: AlertTriangle,
    chip: 'bg-amber-50 text-amber-800 ring-amber-200',
    iconColor: 'text-amber-600',
    fill: 'bg-amber-500',
    track: 'bg-amber-100',
  },
  behind: {
    label: 'Behind',
    icon: AlertOctagon,
    chip: 'bg-red-50 text-red-800 ring-red-200',
    iconColor: 'text-red-600',
    fill: 'bg-red-500',
    track: 'bg-red-100',
  },
  no_plan: {
    label: 'No plan',
    icon: CircleDashed,
    chip: 'bg-slate-50 text-slate-600 ring-slate-200',
    iconColor: 'text-slate-400',
    fill: 'bg-slate-400',
    track: 'bg-slate-100',
  },
}

export const STATUS_SEVERITY = { behind: 0, at_risk: 1, on_track: 2, no_plan: 3 }

export function StatusPill({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.no_plan
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.chip}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {meta.label}
    </span>
  )
}

export const percent = (ratio) => `${Math.round(ratio * 100)}%`

