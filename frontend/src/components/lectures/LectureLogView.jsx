import { useEffect, useMemo, useState } from 'react'
import { CalendarOff, CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck, Loader2 } from 'lucide-react'
import ViewHeader from '../ui/ViewHeader'
import SectionTabs from '../ui/SectionTabs'
import DataSourceBadge from '../ui/DataSourceBadge'
import ErrorBanner from '../ErrorBanner'
import LectureLogRow from './LectureLogRow'
import LectureHistoryTable from './LectureHistoryTable'
import { useAcademicCalendar } from '../../hooks/useAcademicCalendar'
import { useLectureLogs } from '../../hooks/useLectureLogs'
import { useSyllabus } from '../../hooks/useSyllabus'
import { DAY_LABELS } from '../../data/samplePayload'
import { addDays, dayIndexOf, formatDate, holidayOn, nonTeachingReason, todayISO, weekOfSemester } from '../../utils/calendar'
import { sessionsForDay } from '../../utils/schedule'
import { logForSession, logKey } from '../../utils/lectureLogs'
import { coverageByUnit, suggestUnit } from '../../utils/progress'
import { getErrorMessage } from '../../api/errors'

function NoClasses({ title, detail }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <CalendarOff className="h-6 w-6 text-slate-400" aria-hidden />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

/** Day-by-day lecture completion log for one section. */
export default function LectureLogView({
  section,
  sections,
  onSectionChange,
  sectionClasses,
  courses,
  numDays,
  focus,
  logsRevision,
  onNotify,
}) {
  const { calendar, error: calendarError } = useAcademicCalendar()
  const { logs, loading, error: logsError, saveLog, addLogs, removeLog } = useLectureLogs(section, logsRevision)
  const { syllabusFor } = useSyllabus(section)

  const [date, setDate] = useState(() => focus?.date ?? todayISO())
  const [bulkSaving, setBulkSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  // A class card's "Log" action lands here with the slot to highlight.
  useEffect(() => {
    if (focus) setDate(focus.date)
  }, [focus])

  const today = todayISO()
  const day = dayIndexOf(date)
  const isFuture = date > today
  const closedReason = calendar ? nonTeachingReason(date, calendar, numDays) : null
  const holiday = calendar ? holidayOn(date, calendar) : null

  const sessions = useMemo(
    () => (day < numDays ? sessionsForDay(sectionClasses, day, courses, section) : []),
    [sectionClasses, day, numDays, courses, section],
  )
  const logsByKey = useMemo(() => new Map(logs.map((l) => [logKey(l.course_id, l.date, l.period), l])), [logs])
  const coverage = useMemo(() => {
    const byCourse = new Map()
    for (const course of courses) byCourse.set(course.id, coverageByUnit(logs.filter((l) => l.course_id === course.id)))
    return byCourse
  }, [logs, courses])

  const pending = sessions.filter((s) => s.course_id && !logsByKey.has(logKey(s.course_id, date, s.period)))
  const loggedCount = sessions.length - pending.length

  const suggestedUnitFor = (session) => {
    if (!session.course) return null
    return suggestUnit(syllabusFor(session.course).units, coverage.get(session.course_id))
  }

  const stepTeachingDay = (direction) => {
    let next = date
    for (let i = 0; i < 14; i++) {
      next = addDays(next, direction)
      if (!calendar || !nonTeachingReason(next, calendar, numDays)) break
    }
    setDate(next)
  }

  const markPendingConducted = async () => {
    setBulkSaving(true)
    setActionError('')
    try {
      const entries = pending.map((session) => {
        const unit = suggestedUnitFor(session)
        return logForSession({ section, session, date, status: 'conducted', unit_id: unit?.id ?? null, topic: '', reason: null, remarks: '' })
      })
      await addLogs(entries)
      onNotify(`${entries.length} lecture${entries.length === 1 ? '' : 's'} on ${formatDate(date)} logged as conducted.`)
    } catch (e) {
      setActionError(getErrorMessage(e))
    } finally {
      setBulkSaving(false)
    }
  }

  const handleSave = async (log, existing) => {
    const saved = await saveLog(log, existing)
    onNotify(`${saved.course_name} on ${formatDate(saved.date)} saved as ${saved.status === 'conducted' ? 'conducted' : 'not held'}.`)
  }

  const handleDelete = async (log) => {
    if (!window.confirm(`Remove the log for ${log.course_name} on ${formatDate(log.date)}?`)) return
    try {
      await removeLog(log.id)
      onNotify('Log removed.')
    } catch (e) {
      setActionError(getErrorMessage(e))
    }
  }

  let closedMessage = null
  if (closedReason === 'holiday') closedMessage = { title: `Holiday: ${holiday.label}`, detail: 'No lectures are expected on this date.' }
  if (closedReason === 'weekly_off') closedMessage = { title: `${formatDate(date, { year: undefined })} is not a working day`, detail: `The timetable runs ${DAY_LABELS[0]} to ${DAY_LABELS[numDays - 1]}.` }
  if (closedReason === 'outside_semester')
    closedMessage = {
      title: 'Outside the semester',
      detail: `The semester runs ${formatDate(calendar.semester_start)} to ${formatDate(calendar.semester_end)}. Change it in Syllabus Progress.`,
    }

  const highlightFor = (session) =>
    focus && focus.date === date && focus.period === session.period && focus.courseId === session.course_id ? focus : null

  return (
    <div className="w-full space-y-6 motion-safe:animate-fade-up">
      <ViewHeader
        icon={ClipboardCheck}
        title="Lecture Log"
        subtitle={`Section ${section} · record what was taught, or why it was not`}
      >
        <SectionTabs sections={sections} active={section} onChange={onSectionChange} />
      </ViewHeader>

      <ErrorBanner message={logsError || calendarError || actionError} onDismiss={actionError ? () => setActionError('') : undefined} />

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => stepTeachingDay(-1)}
              aria-label="Previous teaching day"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Date</span>
              <input
                type="date"
                className="builder-input w-44"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => stepTeachingDay(1)}
              aria-label="Next teaching day"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDate(today)}
              disabled={date === today}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Today
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{formatDate(date)}</span>
            {calendar && !closedReason && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">Week {weekOfSemester(date, calendar)}</span>
            )}
            {!closedReason && sessions.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                {loggedCount}/{sessions.length} logged
              </span>
            )}
            <DataSourceBadge />
          </div>
        </div>

        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading logs…
          </div>
        ) : closedMessage ? (
          <NoClasses {...closedMessage} />
        ) : sessions.length === 0 ? (
          <NoClasses title={`No classes for ${section} on ${DAY_LABELS[day]}`} detail="Pick another date, or add an extra class from the timetable." />
        ) : (
          <>
            <ul className="space-y-3">
              {sessions.map((session) => {
                const existing = session.course_id ? logsByKey.get(logKey(session.course_id, date, session.period)) : undefined
                const highlight = highlightFor(session)
                return (
                  <LectureLogRow
                    key={`${date}|${session.key}|${existing?.updated_at ?? 'new'}|${highlight?.nonce ?? ''}`}
                    section={section}
                    session={session}
                    date={date}
                    existing={existing}
                    units={session.course ? syllabusFor(session.course).units : []}
                    suggestedUnitId={suggestedUnitFor(session)?.id}
                    preset={highlight?.status}
                    highlighted={Boolean(highlight)}
                    isFuture={isFuture}
                    onSave={handleSave}
                    onDelete={handleDelete}
                  />
                )
              })}
            </ul>
            {pending.length > 0 && !isFuture && (
              <div className="mt-4 flex flex-col items-start gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {pending.length} session{pending.length === 1 ? '' : 's'} not logged yet. Units are filled in from where each course is in its syllabus.
                </p>
                <button
                  type="button"
                  onClick={markPendingConducted}
                  disabled={bulkSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-slate-900 disabled:opacity-50"
                >
                  {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCheck className="h-4 w-4" aria-hidden />}
                  Mark {pending.length === sessions.length ? 'all' : 'the rest'} as conducted
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <LectureHistoryTable
        logs={logs}
        courses={courses}
        syllabusFor={syllabusFor}
        onOpenDate={(d) => {
          setDate(d)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onDelete={handleDelete}
      />
    </div>
  )
}
