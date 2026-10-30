import { Database, HardDrive } from 'lucide-react'
import { DATA_SOURCE } from '../../api/config'

/** Says where lecture logs and syllabus data are stored, so a demo never overstates it. */
export default function DataSourceBadge() {
  const local = DATA_SOURCE === 'local'
  const Icon = local ? HardDrive : Database
  return (
    <span
      title={
        local
          ? 'Lecture logs, syllabus units and the semester calendar are stored in this browser until the backend endpoints are available.'
          : 'Lecture logs, syllabus units and the semester calendar are stored on the AcadFlow server.'
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        local ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {local ? 'Saved in this browser' : 'Synced with server'}
    </span>
  )
}
