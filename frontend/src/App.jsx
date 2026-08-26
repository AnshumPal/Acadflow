import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Clock,
  Coffee,
  Download,
  ExternalLink,
  Grid3X3,
  Layers,
  Loader2,
  MousePointerClick,
  Sparkles,
  LayoutGrid,
  Trash2,
  Plus,
  Settings,
  Code,
  X
} from 'lucide-react'
import {
  generateTimetable,
  exportExcel,
  scheduleExtra,
  rescheduleDynamic,
  getErrorMessage,
} from './api/client'
import ErrorBanner from './components/ErrorBanner'
import TimetableGrid from './components/TimetableGrid'
import AddExtraModal from './components/AddExtraModal'
import RescheduleModal from './components/RescheduleModal'
import { samplePayload, DAY_LABELS } from './data/samplePayload'

const defaultPayload = samplePayload

const emptyPayload = {
  num_days: 6,
  num_periods: 8,
  sections: [],
  teachers: [],
  rooms: [],
  courses: []
}

function normalizeCourseName(name) {
  return name.replace(/\s*\(Rescheduled\)\s*$/i, '').replace(/\s*\(Extra\)\s*$/i, '').trim()
}

function findCourseForClass(cls, section, catalog) {
  const base = normalizeCourseName(cls.course_name)
  return catalog.find((c) => c.section === section && c.name === base)
}

const SCHEDULE_STORAGE_KEY = 'acadflow_schedule_v1'

function loadScheduleFromStorage() {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (Object.keys(parsed).length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export default function App() {
  // --- STATE ---
  const [schedule, setSchedule] = useState(null)
  const [activeSection, setActiveSection] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  
  // NEW: Top Level Navigation State
  const [activeView, setActiveView] = useState('setup') // 'setup' | 'timetable'
  
  const [extraModal, setExtraModal] = useState(null)
  const [rescheduleModal, setRescheduleModal] = useState(null)

  // --- BUILDER STATE ---
  const [inputMode, setInputMode] = useState('visual') // 'visual' | 'json'
  const [payload, setPayload] = useState(defaultPayload)
  const [jsonInput, setJsonInput] = useState(JSON.stringify(defaultPayload, null, 2))

  // New Item Input States
  const [newSection, setNewSection] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const [newTeacher, setNewTeacher] = useState('')

  const [newCourse, setNewCourse] = useState({
    id: '', name: '', teachers: '', section: '', credits: 3, is_lab: false, elective_group: '', fixed_period: '', parallel_group: ''
  })

  // RBU credit scheme: theory 1 credit = 1 period/week, lab 1 credit = 2 periods/week.
  const periodsFromCredits = (credits, isLab) => (Number(credits) || 0) * (isLab ? 2 : 1)

  // Sync JSON text to Payload object
  useEffect(() => {
    if (inputMode === 'json') {
      try {
        const parsed = JSON.parse(jsonInput)
        setPayload(parsed)
      } catch (e) {}
    } else {
      setJsonInput(JSON.stringify(payload, null, 2))
    }
  }, [jsonInput, inputMode, payload])

  useEffect(() => {
    if (payload.sections.length > 0) {
      if (!activeSection) setActiveSection(payload.sections[0])
      if (!newCourse.section) setNewCourse(prev => ({ ...prev, section: payload.sections[0] }))
    } else {
      setActiveSection('')
    }
  }, [payload.sections, activeSection, newCourse.section])

  // --- COMPUTED PROPERTIES ---
  const sections = useMemo(() => (schedule ? Object.keys(schedule).sort() : payload.sections), [schedule, payload.sections])
  const coursesForActiveSection = useMemo(() => payload.courses.filter((c) => c.section === activeSection), [payload.courses, activeSection])
  const sectionClasses = schedule?.[activeSection] ?? []

  // --- ACTIONS ---
  const loadTimetable = useCallback(async (fromButton = false) => {
    if (!payload.num_days || payload.num_days < 1) {
      setError("Working days must be at least 1.")
      return
    }
    if (!payload.num_periods || payload.num_periods < 4) {
      setError("Periods per day must be at least 4 (needed for regular lectures and recess).")
      return
    }
    if (!payload.sections || payload.sections.length === 0) {
      setError("Please add at least one section before generating.")
      return
    }
    if (!payload.rooms || payload.rooms.length === 0) {
      setError("Please add at least one classroom/lab room before generating.")
      return
    }
    if (!payload.courses || payload.courses.length === 0) {
      setError("Please add at least one course before generating.")
      return
    }

    setError('')
    if (fromButton) setInfo('')
    setLoading(true)
    try {
      const data = await generateTimetable(payload)
      if (data.status === 'success' && data.schedule) {
        setSchedule(data.schedule)
        const first = Object.keys(data.schedule).sort()[0]
        if (first) setActiveSection(first)
        setInfo(fromButton ? data.message || 'Timetable generated.' : data.message || 'Timetable loaded from backend.')
        
        // Auto-switch to timetable view on success!
        setActiveView('timetable')
      }
    } catch (e) {
      setSchedule(null)
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [payload])

  useEffect(() => {
    const saved = loadScheduleFromStorage()
    if (saved) {
      const first = Object.keys(saved).sort()[0]
      setSchedule(saved)
      if (first) setActiveSection(first)
      setInfo('Saved timetable restored in the background.')
    }
  }, [])

  useEffect(() => {
    if (!schedule) return
    try {
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule))
    } catch (e) {
      console.warn('acadflow: could not persist schedule', e)
    }
  }, [schedule])

  const clearSavedAndRegenerate = useCallback(async () => {
    try { localStorage.removeItem(SCHEDULE_STORAGE_KEY) } catch { }
    setSchedule(null)
    setPayload(emptyPayload)
    setJsonInput(JSON.stringify(emptyPayload, null, 2))
    setActiveSection('')
    setActiveView('setup') // Switch back to setup on clear
    setInfo('Workspace cleared. Start from scratch.')
  }, [])

  const loadRbuTemplate = useCallback(() => {
    try { localStorage.removeItem(SCHEDULE_STORAGE_KEY) } catch { }
    setSchedule(null)
    setPayload(samplePayload)
    setJsonInput(JSON.stringify(samplePayload, null, 2))
    setActiveSection('V A')
    setActiveView('setup')
    setInfo('Loaded official RBU V-Sem AIML timetable preset.')
  }, [])

  const runExport = async () => {
    if (!schedule) return
    setError('')
    setLoading(true)
    try {
      await exportExcel({ schedule, num_days: payload.num_days, num_periods: payload.num_periods })
      setInfo('Excel file downloaded.')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  // --- BUILDER HANDLERS ---
  const handleAddItem = (field, value, setter) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (!payload[field].includes(trimmed)) {
      setPayload(prev => ({ ...prev, [field]: [...prev[field], trimmed] }))
    }
    setter('') 
  }

  const handleRemoveItem = (field, index) => {
    setPayload(prev => {
      const updated = [...prev[field]]
      updated.splice(index, 1)
      return { ...prev, [field]: updated }
    })
  }

  const handleAddCourse = () => {
    if (!newCourse.id || !newCourse.name || !newCourse.section) return alert("ID, Name, and Section are required.")
    
    const courseToAdd = {
      ...newCourse,
      teachers: newCourse.teachers.split(',').map(t => t.trim()).filter(t => t),
      credits: Number(newCourse.credits) || 0,
      hours: periodsFromCredits(newCourse.credits, newCourse.is_lab),
      elective_group: newCourse.elective_group.trim() || null,
      fixed_period: newCourse.fixed_period ? Number(newCourse.fixed_period) : null,
      parallel_group: newCourse.parallel_group.trim() || null
    }

    setPayload(prev => ({
      ...prev,
      courses: [...prev.courses, courseToAdd]
    }))

    setNewCourse({ id: '', name: '', teachers: '', section: payload.sections[0] || '', credits: 3, is_lab: false, elective_group: '', fixed_period: '', parallel_group: '' })
  }

  const handleRemoveCourse = (courseId, section) => {
    setPayload(prev => ({
      ...prev,
      courses: prev.courses.filter(c => !(c.id === courseId && c.section === section))
    }))
  }

  const handleExtraSubmit = async (courseId) => {
    if (!schedule || extraModal === null) return
    setError('')
    setLoading(true)
    try {
      const data = await scheduleExtra({
        current_schedule: schedule,
        course_id: courseId,
        section: activeSection,
        all_courses: payload.courses,
        all_rooms: payload.rooms,
        target_day: extraModal.day,
        num_days: payload.num_days,
        num_periods: payload.num_periods,
      })
      if (data.status === 'success' && data.schedule) {
        setSchedule(data.schedule)
        setInfo(data.message || 'Extra class added.')
        setExtraModal(null)
      }
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleRescheduleSubmit = async (targetDay) => {
    if (!schedule || rescheduleModal === null) return
    const cls = rescheduleModal.cls
    const course = findCourseForClass(cls, activeSection, payload.courses)
    if (!course) {
      setError('Could not match this slot to a catalog course for rescheduling.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await rescheduleDynamic({
        current_schedule: schedule,
        target_day: targetDay,
        course,
        all_rooms: payload.rooms,
        num_periods: payload.num_periods,
      })
      if (data.status === 'success' && data.schedule) {
        setSchedule(data.schedule)
        setInfo(data.message || 'Schedule updated.')
        setRescheduleModal(null)
      }
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="acadflow-page-bg acadflow-grid-noise relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-blue-400/[0.12] blur-3xl" />
        <div className="absolute -right-20 top-40 h-[22rem] w-[22rem] rounded-full bg-indigo-500/[0.1] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-slate-300/[0.15] blur-3xl" />
      </div>

      <div className="relative">
        {loading && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/[0.18] backdrop-blur-[3px]">
            <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/[0.97] px-10 py-9 shadow-glow">
              <div className="relative flex flex-col items-center gap-5">
                <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
                <p className="text-sm font-semibold text-slate-800">Processing Request...</p>
              </div>
            </div>
          </div>
        )}

        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md">
                <LayoutGrid className="h-[18px] w-[18px]" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-slate-900">AcadFlow Studio</span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={loadRbuTemplate}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                title="Load the official Ramdeobaba University V-Semester AIML Timetable"
              >
                <Sparkles className="h-4 w-4 text-amber-500" /> <span className="hidden sm:inline">Load RBU Template</span>
              </button>
              <button
                onClick={clearSavedAndRegenerate}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Clear All</span>
              </button>
              <button
                onClick={() => loadTimetable(true)}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Generate Timetable</span>
              </button>
              {schedule && (
                <button
                  onClick={runExport}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4 text-blue-600" /> <span className="hidden sm:inline">Export Excel</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Increased max-width here for extreme wide layout */}
        <main className="mx-auto max-w-[1600px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          
          {/* TOP TABS - The View Switcher */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 shadow-inner backdrop-blur-sm">
              <button
                onClick={() => setActiveView('setup')}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeView === 'setup'
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <Settings className="h-4 w-4" /> 1. Configuration & Data
              </button>
              <button
                onClick={() => schedule && setActiveView('timetable')}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeView === 'timetable'
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                    : !schedule
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <Grid3X3 className="h-4 w-4" /> 2. Generated Timetable
              </button>
            </div>
          </div>

          <ErrorBanner message={error} onDismiss={() => setError('')} />

          {/* VIEW 1: CONFIGURATION BUILDER */}
          {activeView === 'setup' && (
            <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2">
                  <button onClick={() => setInputMode('visual')} className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${inputMode === 'visual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>
                    <Settings className="h-4 w-4" /> Visual Builder
                  </button>
                  <button onClick={() => setInputMode('json')} className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${inputMode === 'json' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>
                    <Code className="h-4 w-4" /> Raw JSON
                  </button>
                </div>

                <div className="p-6">
                  {inputMode === 'json' ? (
                    <textarea 
                      className="w-full h-[600px] font-mono text-xs p-4 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 ring-blue-500 outline-none"
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                    />
                  ) : (
                    <div className="space-y-10">
                      {/* Global Settings */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-800 border-b pb-2">Global Settings</h4>
                        <div className="grid grid-cols-2 gap-4 max-w-lg">
                          <div>
                            <label className="text-xs text-slate-500 font-medium">Working Days (1–7)</label>
                            <input 
                              type="number" 
                              min={1} 
                              max={7} 
                              className="builder-input mt-1" 
                              value={payload.num_days ?? ''} 
                              onChange={e => {
                                const val = parseInt(e.target.value)
                                setPayload({...payload, num_days: isNaN(val) ? '' : val})
                              }} 
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 font-medium">Periods per Day (min 4)</label>
                            <input 
                              type="number" 
                              min={4} 
                              max={12} 
                              className="builder-input mt-1" 
                              value={payload.num_periods ?? ''} 
                              onChange={e => {
                                const val = parseInt(e.target.value)
                                setPayload({...payload, num_periods: isNaN(val) ? '' : val})
                              }} 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Infrastructure (Chips) */}
                      <div className="space-y-6">
                        <h4 className="text-sm font-bold text-slate-800 border-b pb-2">Infrastructure</h4>
                        
                        {/* Sections Array */}
                        <div>
                          <label className="text-sm font-semibold text-slate-700">Sections (Classes)</label>
                          <div className="flex flex-wrap gap-2 mt-2 mb-3">
                            {payload.sections.map((sec, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100">
                                {sec}
                                <button onClick={() => handleRemoveItem('sections', idx)} className="hover:text-indigo-900 transition bg-white/50 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2 max-w-lg">
                            <input 
                              className="builder-input flex-1" 
                              placeholder="Add section (e.g. AIML-A)" 
                              value={newSection} 
                              onChange={e => setNewSection(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem('sections', newSection, setNewSection); } }}
                            />
                            <button type="button" onClick={() => handleAddItem('sections', newSection, setNewSection)} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"><Plus className="h-5 w-5" /></button>
                          </div>
                        </div>

                        {/* Rooms Array */}
                        <div>
                          <label className="text-sm font-semibold text-slate-700">Rooms <span className="font-normal text-xs text-slate-400 ml-2">(Must include 'Lab' for laboratory rooms)</span></label>
                          <div className="flex flex-wrap gap-2 mt-2 mb-3">
                            {payload.rooms.map((room, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100">
                                {room}
                                <button onClick={() => handleRemoveItem('rooms', idx)} className="hover:text-emerald-900 transition bg-white/50 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2 max-w-lg">
                            <input 
                              className="builder-input flex-1" 
                              placeholder="Add room (e.g. Lab 401)" 
                              value={newRoom} 
                              onChange={e => setNewRoom(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem('rooms', newRoom, setNewRoom); } }}
                            />
                            <button type="button" onClick={() => handleAddItem('rooms', newRoom, setNewRoom)} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"><Plus className="h-5 w-5" /></button>
                          </div>
                        </div>

                        {/* Teachers Array */}
                        <div>
                          <label className="text-sm font-semibold text-slate-700">Teachers</label>
                          <div className="flex flex-wrap gap-2 mt-2 mb-3">
                            {payload.teachers.map((t, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium border border-amber-100">
                                {t}
                                <button onClick={() => handleRemoveItem('teachers', idx)} className="hover:text-amber-900 transition bg-white/50 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2 max-w-lg">
                            <input 
                              className="builder-input flex-1" 
                              placeholder="Add teacher (e.g. Dr. Smith)" 
                              value={newTeacher} 
                              onChange={e => setNewTeacher(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem('teachers', newTeacher, setNewTeacher); } }}
                            />
                            <button type="button" onClick={() => handleAddItem('teachers', newTeacher, setNewTeacher)} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"><Plus className="h-5 w-5" /></button>
                          </div>
                        </div>
                      </div>

                      {/* Courses */}
                      <div className="space-y-6">
                        <h4 className="text-sm font-bold text-slate-800 border-b pb-2 flex justify-between items-center">
                          Courses Overview ({payload.courses.length})
                        </h4>
                        
                        {/* Add Course Form */}
                        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                          <p className="text-sm font-bold text-slate-700">Add New Course</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input placeholder="Course ID (e.g. CS101)" className="builder-input" value={newCourse.id} onChange={e => setNewCourse({...newCourse, id: e.target.value})} />
                            <input placeholder="Course Name (e.g. Web Dev)" className="builder-input" value={newCourse.name} onChange={e => setNewCourse({...newCourse, name: e.target.value})} />
                            <select className="builder-input" value={newCourse.section} onChange={e => setNewCourse({...newCourse, section: e.target.value})}>
                              <option value="" disabled>Assign to Section...</option>
                              {payload.sections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input placeholder="Teacher Initials (comma separated)" className="builder-input" value={newCourse.teachers} onChange={e => setNewCourse({...newCourse, teachers: e.target.value})} />
                            <div className="flex items-center gap-3 px-4 border border-slate-200 rounded-lg bg-white">
                              <input type="checkbox" checked={newCourse.is_lab} onChange={e => setNewCourse({...newCourse, is_lab: e.target.checked})} id="islab" className="w-4 h-4 text-blue-600 rounded" />
                              <label htmlFor="islab" className="text-sm font-medium text-slate-700 cursor-pointer">Requires Lab Room</label>
                            </div>
                            <div>
                              <label htmlFor="credits" className="text-xs font-semibold text-slate-600 mb-1 block">Credits</label>
                              <div className="flex items-center gap-2">
                                <input id="credits" type="number" min="1" placeholder="Credits" className="builder-input flex-1" value={newCourse.credits} onChange={e => setNewCourse({...newCourse, credits: parseInt(e.target.value)})} />
                                <span className="whitespace-nowrap rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 border border-blue-100">
                                  = {periodsFromCredits(newCourse.credits, newCourse.is_lab)} period{periodsFromCredits(newCourse.credits, newCourse.is_lab) === 1 ? '' : 's'}/week
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400">RBU scheme: theory 1 credit = 1 period/week · lab 1 credit = 2 periods/week.</p>
                          <input placeholder="Elective Group (Leave blank for core subjects, e.g. Elective-1)" className="builder-input w-full" value={newCourse.elective_group} onChange={e => setNewCourse({...newCourse, elective_group: e.target.value})} />
                          <div>
                            <label htmlFor="fixedperiod" className="text-xs font-semibold text-slate-600 mb-1 block">Pin to period (optional)</label>
                            <input id="fixedperiod" type="number" min="1" max={payload.num_periods} placeholder={`Fixed slot, e.g. 1 — for MDM / OE / Honors / Idea Lab`} className="builder-input w-full" value={newCourse.fixed_period} onChange={e => setNewCourse({...newCourse, fixed_period: e.target.value})} />
                          </div>
                          <div>
                            <label htmlFor="parallelgroup" className="text-xs font-semibold text-slate-600 mb-1 block">Parallel batch group (labs, optional)</label>
                            <input id="parallelgroup" placeholder="Same tag on two labs → they run in parallel (A1/A2 ‖ A3/A4)" className="builder-input w-full" value={newCourse.parallel_group} onChange={e => setNewCourse({...newCourse, parallel_group: e.target.value})} />
                          </div>
                          <button onClick={handleAddCourse} className="w-full mt-2 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold shadow-md transition flex justify-center items-center gap-2">
                            <Plus className="h-5 w-5" /> Append Course to Catalog
                          </button>
                        </div>

                        {/* Course List */}
                        <div className="space-y-3">
                          {payload.courses.length === 0 && (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">No courses mapped yet. Use the form above.</p>
                          )}
                          {payload.courses.slice().reverse().map((c, i) => (
                            <div key={i} className="flex items-center justify-between bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm hover:shadow-md transition">
                              <div>
                                <p className="text-base font-bold text-slate-800">{c.name} <span className="text-xs text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded-full ml-2 border border-blue-200">{c.section}</span></p>
                                <p className="text-sm text-slate-500 mt-1">{c.is_lab ? 'Lab' : 'Theory'} · {c.credits ?? '?'} cr → {c.hours} period{c.hours === 1 ? '' : 's'}/week · {c.teachers.join(', ')} {c.elective_group && `· ${c.elective_group}`} {c.fixed_period && `· 📌 period ${c.fixed_period}`} {c.parallel_group && `· ⇄ ${c.parallel_group}`}</p>
                              </div>
                              <button onClick={() => handleRemoveCourse(c.id, c.section)} className="p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition" title="Delete Course">
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: THE FULL-WIDTH TIMETABLE */}
          {activeView === 'timetable' && schedule && (
            <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 border-b border-slate-200/60 pb-6">
                <div className="flex items-center gap-3 text-sm text-slate-500 mb-4 sm:mb-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100/50">
                    <Clock className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-slate-800 leading-tight">Section: {activeSection}</span>
                    <span className="text-sm text-slate-400">{DAY_LABELS.slice(0, payload.num_days).join(', ')} · periods 1–{payload.num_periods}</span>
                  </div>
                </div>
                {sections.length > 0 && (
                  <div className="inline-flex flex-wrap rounded-2xl border border-slate-200/70 bg-slate-100/50 p-1.5 shadow-inner">
                    {sections.map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setActiveSection(sec)}
                        className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                          sec === activeSection
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-white hover:text-slate-900'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xl">
                <TimetableGrid
                  sectionClasses={sectionClasses}
                  numDays={payload.num_days}
                  numPeriods={payload.num_periods}
                  onEmptySlot={(day, period) => setExtraModal({ day, period })}
                  onClassClick={(cls) => !cls.is_recess && setRescheduleModal({ cls })}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      <AddExtraModal
        open={extraModal !== null}
        onClose={() => setExtraModal(null)}
        section={activeSection}
        coursesForSection={coursesForActiveSection}
        targetDay={extraModal?.day}
        loading={loading}
        onSubmit={handleExtraSubmit}
      />

      <RescheduleModal
        open={rescheduleModal !== null}
        onClose={() => setRescheduleModal(null)}
        classLabel={
          rescheduleModal
            ? `${normalizeCourseName(rescheduleModal.cls.course_name)} · Period ${rescheduleModal.cls.period} · ${DAY_LABELS[rescheduleModal.cls.day]}`
            : ''
        }
        numDays={payload.num_days}
        loading={loading}
        onSubmit={handleRescheduleSubmit}
      />
    </div>
  )
}