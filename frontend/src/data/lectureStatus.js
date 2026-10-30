export const NOT_HELD_REASONS = [
  { value: 'faculty_leave', label: 'Faculty on leave' },
  { value: 'holiday', label: 'Holiday / institute closed' },
  { value: 'event', label: 'Institute event or exam' },
  { value: 'other', label: 'Other' },
]

export function reasonLabel(value) {
  return NOT_HELD_REASONS.find((r) => r.value === value)?.label ?? 'Not held'
}

export const SLOT_TYPE_LABELS = {
  regular: 'Regular',
  extra: 'Extra',
  rescheduled: 'Moved',
}
