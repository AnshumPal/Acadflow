export default function SectionTabs({ sections, active, onChange }) {
  if (sections.length === 0) return null
  return (
    <div
      role="group"
      aria-label="Section"
      className="inline-flex max-w-full flex-wrap rounded-2xl border border-slate-200/70 bg-slate-100/50 p-1.5 shadow-inner"
    >
      {sections.map((sec) => (
        <button
          key={sec}
          type="button"
          aria-pressed={sec === active}
          onClick={() => onChange(sec)}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            sec === active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          {sec}
        </button>
      ))}
    </div>
  )
}
