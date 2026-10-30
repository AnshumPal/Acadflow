/** Top-level view switcher: four equal columns on phones, full numbered labels from `lg` up. */
export default function ViewTabs({ views, active, onChange }) {
  return (
    <nav aria-label="AcadFlow views" className="mb-8 flex justify-center">
      <div className="grid w-full grid-cols-4 gap-1 rounded-2xl border border-slate-200/60 bg-slate-100/80 p-1.5 shadow-inner backdrop-blur-sm sm:inline-flex sm:w-auto">
        {views.map(({ id, label, shortLabel, icon: Icon, disabled }, i) => {
          const selected = id === active
          return (
            <button
              key={id}
              type="button"
              aria-current={selected ? 'page' : undefined}
              aria-disabled={disabled || undefined}
              title={disabled ? 'Generate a timetable first' : undefined}
              onClick={() => !disabled && onChange(id)}
              className={`flex min-w-0 flex-col items-center gap-1 whitespace-nowrap rounded-xl px-1 py-2 text-[11px] font-semibold transition-all sm:flex-row sm:gap-2 sm:px-5 sm:text-sm ${
                selected
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : disabled
                  ? 'cursor-not-allowed text-slate-400'
                  : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="lg:hidden">{shortLabel}</span>
              <span className="hidden lg:inline">
                {i + 1}. {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
