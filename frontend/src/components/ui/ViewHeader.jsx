/** Title row shared by the timetable, lecture log and progress views. */
export default function ViewHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-slate-200/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100/50">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-bold leading-tight text-slate-800">{title}</span>
          {subtitle && <span className="text-sm text-slate-400">{subtitle}</span>}
        </div>
      </div>
      {children}
    </div>
  )
}
