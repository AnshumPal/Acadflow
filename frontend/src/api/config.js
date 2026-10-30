// Runtime configuration for the API layer, read from Vite env vars (see frontend/.env.example).

// Empty = same origin. In dev (and `vite preview`) the Vite proxy forwards /api to FastAPI on :8000,
// which avoids CORS entirely. Set VITE_API_BASE_URL only when the backend lives on another origin.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

// Where lecture logs, syllabus units and the academic calendar are stored.
//   'local'  → this browser's localStorage (default until the backend ships those endpoints)
//   'remote' → /api/v1/lectures, /api/v1/syllabus, /api/v1/calendar
export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE === 'remote' ? 'remote' : 'local'

export const TIMEOUTS = {
  default: 15_000,
  generate: 60_000, // the CP-SAT solve is capped at 45s server-side
  export: 30_000,
}

// Backend features that change frontend behaviour. Flip them on once the backend merges them.
export const BACKEND_CAPABILITIES = {
  // RescheduleRequest.target_period is honoured, so the user can pick the exact period.
  reschedulePeriodPick: import.meta.env.VITE_RESCHEDULE_TARGET_PERIOD === 'true',
  // Lab courses are rescheduled as a 2-period block instead of a single period.
  rescheduleLabBlocks: import.meta.env.VITE_RESCHEDULE_LAB_BLOCKS === 'true',
}
