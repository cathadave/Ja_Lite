'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import ConfirmModal from '@/components/ConfirmModal'
import ProgressBar from '@/components/onboarding/ProgressBar'
import StepProjectDetails from '@/components/onboarding/StepProjectDetails'
import StepTaskReview from '@/components/onboarding/StepTaskReview'
import StepAssignContacts from '@/components/onboarding/StepAssignContacts'
import StepReview from '@/components/onboarding/StepReview'
import { api } from '@/lib/api'
import type { ContactDraft, TaskDraft, ProjectDetails } from '@/lib/types'

const STEP_LABELS = ['Project Details', 'Review Tasks', 'Assign Contacts', 'Review & Save']

const EMPTY_PROJECT: ProjectDetails = {
  name: '',
  address: '',
  startDate: '',
  templateId: '',
  templateName: '',
}

// Shape returned by GET /contacts/
type ApiContact = {
  id: string
  name: string
  company?: string
  contact_type: string
  phone?: string
  email?: string
  preferred_contact_method: string
}

function mapContact(c: ApiContact): ContactDraft {
  return {
    id: c.id,
    name: c.name,
    company: c.company,
    contactType: c.contact_type as ContactDraft['contactType'],
    phone: c.phone,
    email: c.email,
    preferredMethod: c.preferred_contact_method as ContactDraft['preferredMethod'],
    isNew: false,
  }
}

// Shape returned by GET /templates/{id}/tasks
type ApiTemplateTask = {
  id: string
  name: string
  description?: string
  default_duration_days: number
}

function autoSchedule(templateTasks: ApiTemplateTask[], startDate: string): TaskDraft[] {
  let cursor = new Date(startDate)
  return templateTasks.map(t => {
    const start = new Date(cursor)
    const end = new Date(cursor)
    end.setDate(end.getDate() + (t.default_duration_days || 1))
    cursor = new Date(end)
    return {
      tempId: crypto.randomUUID(),
      name: t.name,
      description: t.description,
      scheduledStart: start.toISOString().split('T')[0],
      scheduledEnd: end.toISOString().split('T')[0],
      templateTaskId: t.id,
      assignments: [],
    }
  })
}

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [project, setProject] = useState<ProjectDetails>(EMPTY_PROJECT)
  const [tasks, setTasks] = useState<TaskDraft[]>([])
  const [contacts, setContacts] = useState<ContactDraft[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Fetch existing contacts once on mount for the assignment step
  useEffect(() => {
    api.get<ApiContact[]>('/contacts/')
      .then(data => setContacts(data.map(mapContact)))
      .catch(() => {})
  }, [])

  // Step 1 → 2: load and auto-schedule template tasks if a template was chosen
  async function handleStep1Next(data: ProjectDetails) {
    setProject(data)
    if (data.templateId) {
      try {
        const tplTasks = await api.get<ApiTemplateTask[]>(`/templates/${data.templateId}/tasks`)
        setTasks(autoSchedule(tplTasks, data.startDate))
      } catch {
        setTasks([])
      }
    } else {
      setTasks([])
    }
    setStep(2)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    setShowConfirm(false)

    try {
      // 1. Create project
      const newProject = await api.post<{ id: string }>('/projects/', {
        name: project.name,
        ...(project.address && { address: project.address }),
        start_date: project.startDate,
        ...(project.templateId && { template_id: project.templateId }),
        status: 'planning',
      })
      const projectId = newProject.id

      // 2. Create new contacts — deduplicated by name
      const nameToId = new Map<string, string>()
      const seen = new Set<string>()
      const newContacts: ContactDraft[] = []
      for (const task of tasks) {
        for (const { contact } of task.assignments) {
          if (contact.isNew && !seen.has(contact.name)) {
            seen.add(contact.name)
            newContacts.push(contact)
          }
        }
      }
      for (const contact of newContacts) {
        const created = await api.post<{ id: string }>('/contacts/', {
          name: contact.name,
          ...(contact.company && { company: contact.company }),
          ...(contact.phone && { phone: contact.phone }),
          ...(contact.email && { email: contact.email }),
          contact_type: contact.contactType,
          preferred_contact_method: contact.preferredMethod,
        })
        nameToId.set(contact.name, created.id)
      }

      // 3. Bulk create tasks
      const taskPayload = tasks.map(t => ({
        name: t.name,
        ...(t.description && { description: t.description }),
        ...(t.scheduledStart && { scheduled_start: `${t.scheduledStart}T07:00:00` }),
        ...(t.scheduledEnd && { scheduled_end: `${t.scheduledEnd}T17:00:00` }),
        ...(t.templateTaskId && { template_task_id: t.templateTaskId }),
        status: 'pending',
      }))
      const createdTasks = await api.post<{ id: string }[]>(
        `/projects/${projectId}/tasks/bulk`,
        taskPayload
      )

      // 4. Bulk create assignments
      const allAssignments: { task_id: string; contact_id: string; role: string }[] = []
      for (let i = 0; i < tasks.length; i++) {
        for (const assignment of tasks[i].assignments) {
          const contactId = assignment.contact.isNew
            ? nameToId.get(assignment.contact.name)
            : assignment.contact.id
          if (!contactId) continue
          allAssignments.push({
            task_id: createdTasks[i].id,
            contact_id: contactId,
            role: assignment.role,
          })
        }
      }
      if (allAssignments.length > 0) {
        await api.post('/assignments/bulk', allAssignments)
      }

      // 5. Navigate to the new project
      router.push(`/projects/${projectId}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.')
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="New Start" subtitle="Set up a new project" showBack />
      <ProgressBar currentStep={step} labels={STEP_LABELS} />

      {step === 1 && (
        <StepProjectDetails
          data={project}
          onNext={handleStep1Next}
        />
      )}
      {step === 2 && (
        <StepTaskReview
          tasks={tasks}
          projectStartDate={project.startDate}
          onBack={() => setStep(1)}
          onNext={updated => { setTasks(updated); setStep(3) }}
        />
      )}
      {step === 3 && (
        <StepAssignContacts
          tasks={tasks}
          contacts={contacts}
          onBack={() => setStep(2)}
          onNext={updated => { setTasks(updated); setStep(4) }}
        />
      )}
      {step === 4 && (
        <StepReview
          project={project}
          tasks={tasks}
          onBack={() => setStep(3)}
          onConfirm={() => setShowConfirm(true)}
          saving={saving}
          error={saveError}
        />
      )}

      {showConfirm && (
        <ConfirmModal
          title="Save project?"
          message={`"${project.name}" will be created with ${tasks.length} task${tasks.length !== 1 ? 's' : ''}.`}
          confirmLabel="Save Project"
          onConfirm={handleSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
