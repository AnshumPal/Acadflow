import { useMemo, useState } from 'react'
import { ClipboardCheck, Loader2, TrendingUp, WandSparkles } from 'lucide-react'
import ViewHeader from '../ui/ViewHeader'
import SectionTabs from '../ui/SectionTabs'
import DataSourceBadge from '../ui/DataSourceBadge'
import ErrorBanner from '../ErrorBanner'
import ProgressSummaryCards from './ProgressSummaryCards'
import CourseProgressList from './CourseProgressList'
import AuditWidget from './AuditWidget'
import SemesterSettingsCard from './SemesterSettingsCard'
import SyllabusEditorModal from './SyllabusEditorModal'
import { useAcademicCalendar } from '../../hooks/useAcademicCalendar'
import { useLectureLogs } from '../../hooks/useLectureLogs'
import { useSyllabus } from '../../hooks/useSyllabus'
import { buildSectionProgress } from '../../utils/progress'
import { formatDate, todayISO } from '../../utils/calendar'
import { buildSampleLogs } from '../../data/sampleLogs'
import { DATA_SOURCE } from '../../api/config'
import { getErrorMessage } from '../../api/errors'

/** Syllabus completion per course for one section, with an audit of what needs attention. */
export default function ProgressDashboard({
  section,
  sections,
  onSectionChange,
  sectionClasses,
  courses,
  numDays,
  logsRevision,
  onNotify,
  onOpenLectureLog,
}) {
  const { calendar, error: calendarError, saveCalendar } = useAcademicCalendar()
  const { logs, loading: logsLoading, error: logsError, addLogs } = useLectureLogs(section, logsRevision)
  const { syllabusFor, saveCourseSyllabus, resetCourseSyllabus, error: syllabusError } = useSyllabus(section)

  const [editingCourse, setEditingCourse] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [actionError, setActionError] = useState('')

  const progress = useMemo(
    () => (calendar ? buildSectionProgress({ section, courses, sectionClasses, logs, calendar, numDays, syllabusFor }) : null),
    [calendar, section, courses, sectionClasses, logs, numDays, syllabusFor],
  )

  const fillSampleLogs = async () => {
    setSeeding(true)
    setActionError('')
    try {
      const entries = buildSampleLogs({ section, sectionClasses, courses, calendar, numDays, syllabusFor, until: todayISO() })
      await addLogs(entries)
      onNotify(`${entries.length} sample lecture logs added for ${section}.`)
    } catch (e) {
      setActionError(getErrorMessage(e))
    } finally {
      setSeeding(false)
    }
  }

  const editingRow = editingCourse ? progress?.courses.find((r) => r.course.id === editingCourse.id) : null

  return (
    <div className="w-full space-y-6 motion-safe:animate-fade-up">
      <ViewHeader
        icon={TrendingUp}
        title="Syllabus Progress"
        subtitle={
          progress
            ? `Section ${section} · week ${progress.week.current} of ${progress.week.total} · ${formatDate(calendar.semester_start)} – ${formatDate(calendar.semester_end)}`
            : `Section ${section}`
        }
      >
        <SectionTabs sections={sections} active={section} onChange={onSectionChange} />
      </ViewHeader>

      <ErrorBanner
        message={logsError || calendarError || syllabusError || actionError}
        onDismiss={actionError ? () => setActionError('') : undefined}
      />

      {!progress || (logsLoading && logs.length === 0) ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading progress…
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              As of {formatDate(progress.asOf)} · {progress.teachingDays.completed} of {progress.teachingDays.total} teaching days completed
            </p>
            <DataSourceBadge />
          </div>

          {logs.length === 0 && (
            <div className="flex flex-col gap-4 rounded-3xl border border-dashed border-blue-200 bg-blue-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">No lectures logged for {section} yet</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Progress fills in as faculty log lectures.
                  {DATA_SOURCE === 'local' && ' For a demo, you can generate illustrative logs up to today.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onOpenLectureLog}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <ClipboardCheck className="h-4 w-4 text-blue-600" aria-hidden /> Open lecture log
                </button>
                {DATA_SOURCE === 'local' && (
                  <button
                    type="button"
                    onClick={fillSampleLogs}
                    disabled={seeding || courses.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {seeding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <WandSparkles className="h-4 w-4" aria-hidden />}
                    Generate sample logs
                  </button>
                )}
              </div>
            </div>
          )}

          <ProgressSummaryCards progress={progress} />

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <CourseProgressList rows={progress.courses} onEditSyllabus={setEditingCourse} />
            </div>
            <div className="space-y-6">
              <AuditWidget flags={progress.audit} logs={logs} onOpenLectureLog={onOpenLectureLog} />
              <SemesterSettingsCard calendar={calendar} numDays={numDays} onSave={saveCalendar} onNotify={onNotify} />
            </div>
          </div>
        </>
      )}

      <SyllabusEditorModal
        course={editingRow ? editingCourse : null}
        syllabus={editingCourse ? syllabusFor(editingCourse) : null}
        creditTarget={editingRow?.creditTarget ?? 0}
        onClose={() => setEditingCourse(null)}
        onSave={async (course, units) => {
          await saveCourseSyllabus(course, units)
          onNotify(`Syllabus for ${course.name} saved.`)
        }}
        onReset={async (course) => {
          await resetCourseSyllabus(course)
          onNotify(`Syllabus for ${course.name} reset.`)
        }}
      />
    </div>
  )
}
