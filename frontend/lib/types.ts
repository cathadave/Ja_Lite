/**
 * lib/types.ts — Shared TypeScript types for the onboarding wizard and beyond.
 */

export type ContactDraft = {
  id?: string
  name: string
  company?: string
  contactType: 'subcontractor' | 'supplier' | 'employee' | 'client' | 'other'
  phone?: string
  email?: string
  preferredMethod: 'sms' | 'email' | 'phone' | 'whatsapp'
  isNew: boolean
}

export type AssignmentDraft = {
  contact: ContactDraft
  role: 'lead' | 'supplier'
}

export type TaskDraft = {
  tempId: string
  name: string
  description?: string
  scheduledStart?: string
  scheduledEnd?: string
  templateTaskId?: string
  assignments: AssignmentDraft[]
}

export type ProjectDetails = {
  name: string
  address: string
  startDate: string
  templateId: string
  templateName: string
}

export type ProjectRecord = {
  id: string
  name: string
  description?: string | null
  address?: string | null
  start_date?: string | null
  status: string
  template_id?: string | null
  created_at?: string
  updated_at?: string
}

export type TaskRecord = {
  id: string
  project_id: string
  template_task_id?: string | null
  name: string
  description?: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked'
  scheduled_start?: string | null
  scheduled_end?: string | null
  actual_start?: string | null
  actual_end?: string | null
  created_at?: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Command parsing
// ---------------------------------------------------------------------------

export type IntentCategory =
  | 'reschedule_task'
  | 'notify_contacts'
  | 'reassign_task'
  | 'create_project'
  | 'complete_task'
  | 'query_schedule'
  | 'compound'
  | 'unknown'

export type ConfidenceLevel = 'high' | 'low'

export type NotificationChannel = 'sms' | 'email' | 'phone' | 'whatsapp'

export type TaskCandidate = {
  id: string
  name: string
  project_id: string
  scheduled_start: string
  scheduled_end: string
}

export type ParsedAction = {
  intent: IntentCategory
  project_id: string | null
  project_name: string | null
  task_id: string | null
  task_name: string | null
  task_candidates: TaskCandidate[]
  contact_id: string | null
  contact_name: string | null
  new_date: string | null
  date_shift: number | null
  notify_affected: boolean
  channel: NotificationChannel | null
  message: string | null
  template_name: string | null
  confidence: ConfidenceLevel
  ambiguities: string[]
  requires_confirmation: boolean
  summary: string
  cascade?: boolean | null
  allow_non_business_day?: boolean
  override_reason?: string
}

export type CommandParseRequest = {
  raw_input: string
}

export type CommandParseResponse = {
  raw_input: string
  actions: ParsedAction[]
  has_low_confidence: boolean
  clarifying_question: string | null
}