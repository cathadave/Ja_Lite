'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle, Circle, Clock, Save, User, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import CommandBar from '@/components/CommandBar'
import { createPortal } from 'react-dom'
import { api } from '@/lib/api'
import type { ProjectRecord, TaskRecord } from '@/lib/types'

const REFRESH_EVENT = 'ja-lite:activity-refresh'

type EditableTask = TaskRecord & {
  scheduledStartInput: string
  scheduledEndInput: string
  originalStartInput: string
  originalEndInput: string
}

interface AssignmentRow     { id: string; task_id: string; contact_id: string; role: string }
interface ContactSummary    { id: string; name: string; company: string | null; trade: string | null }
interface AssignmentDisplay { name: string; company: string | null; role: string }

function toDateInput(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function formatProjectDate(value?: string | null): string {
  if (!value) return 'Not set'
  return value.slice(0, 10)
}

function formatStatusLabel(value?: string | null): string {
  if (!value) return '—'
  return value.replace(/_/g, ' ')
}

function getProjectStatusClasses(status?: string | null): string {
  switch (status) {
    case 'planning':
      return 'border border-blue-400/20 bg-blue-500/10 text-blue-300'
    case 'active':
      return 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
    case 'on_hold':
      return 'border border-amber-400/20 bg-amber-500/10 text-amber-300'
    case 'completed':
      return 'border border-slate-400/20 bg-slate-500/10 text-slate-300'
    default:
      return 'border border-slate-400/20 bg-slate-500/10 text-slate-300'
  }
}

function getTaskStatusClasses(status?: string | null): string {
  switch (status) {
    case 'completed':
      return 'text-emerald-300'
    case 'in_progress':
      return 'text-blue-300'
    case 'pending':
      return 'text-amber-300'
    default:
      return 'text-slate-400'
  }
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const projectId = params?.id ?? ''

  const [project, setProject] = useState<ProjectRecord | null>(null)
  const [tasks, setTasks] = useState<EditableTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [pendingTaskUpdate, setPendingTaskUpdate] = useState<EditableTask | null>(null)
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [actualStartInput, setActualStartInput] = useState('')
  const [actualEndInput, setActualEndInput] = useState('')
  const [completeError, setCompleteError] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(false)
  const [assignmentMap, setAssignmentMap] = useState<Record<string, AssignmentDisplay[]>>({})
  const [allContacts, setAllContacts] = useState<ContactSummary[]>([])
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null)
  const [pickerRole, setPickerRole] = useState('lead')
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  const loadProjectData = useCallback(async () => {
    if (!projectId) return

    setLoading(true)
    setError('')

    try {
      const projectResponse = await api.get<ProjectRecord>(`/projects/${projectId}`)
      setProject(projectResponse)

      const tasksResponse = await api.get<TaskRecord[]>(`/tasks/?project_id=${projectId}`)

      const sortedTasks = [...tasksResponse].sort((a, b) => {
        const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Number.MAX_SAFE_INTEGER
        const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Number.MAX_SAFE_INTEGER
        return aTime - bTime
      })

      setTasks(
        sortedTasks.map((task) => ({
          ...task,
          scheduledStartInput: toDateInput(task.scheduled_start),
          scheduledEndInput: toDateInput(task.scheduled_end),
          originalStartInput: toDateInput(task.scheduled_start),
          originalEndInput: toDateInput(task.scheduled_end),
        }))
      )

      // Fetch assignment + contact data for display — non-critical, page works without it
      try {
        const [allAssignments, allContacts] = await Promise.all([
          api.get<AssignmentRow[]>('/assignments/'),
          api.get<ContactSummary[]>('/contacts/'),
        ])
        const taskIdSet = new Set(sortedTasks.map((t) => t.id))
        const contactById: Record<string, ContactSummary> = {}
        for (const c of allContacts) contactById[c.id] = c
        const aMap: Record<string, AssignmentDisplay[]> = {}
        for (const a of allAssignments) {
          if (!taskIdSet.has(a.task_id)) continue
          const contact = contactById[a.contact_id]
          if (!contact) continue
          if (!aMap[a.task_id]) aMap[a.task_id] = []
          aMap[a.task_id].push({ name: contact.name, company: contact.company, role: a.role })
        }
        setAssignmentMap(aMap)
        setAllContacts(allContacts)
      } catch (assignErr) {
        console.error('[assignments] fetch failed:', assignErr)
        // Assignment visibility failed — task schedule and editing remain fully functional
      }
    } catch (err) {
      console.error('Failed to load project detail page:', err)
      setProject(null)
      setTasks([])
      setError(err instanceof Error ? err.message : 'Could not load project detail.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadProjectData()
  }, [loadProjectData])

  useEffect(() => {
    function handleRefresh() { void loadProjectData() }
    window.addEventListener(REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(REFRESH_EVENT, handleRefresh)
  }, [loadProjectData])

  function updateTaskInput(taskId: string, patch: Partial<EditableTask>) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)))
  }

  function saveTaskDates(task: EditableTask) {
    setPendingTaskUpdate(task)
    setShowCascadeConfirm(true)
  }

  async function confirmCascade(cascade: boolean) {
    if (!pendingTaskUpdate) return
    const task = pendingTaskUpdate
    setPendingTaskUpdate(null)
    setShowCascadeConfirm(false)

    const startChanged = task.scheduledStartInput !== task.originalStartInput
    const endChanged   = task.scheduledEndInput   !== task.originalEndInput

    if (cascade && !startChanged && !endChanged) {
      setSaveMessage(`No date changes detected for "${task.name}"`)
      window.setTimeout(() => setSaveMessage(''), 2500)
      return
    }

    setSavingTaskId(task.id)
    setSaveMessage('')
    setError('')

    try {
      if (cascade) {
        const payload: Record<string, unknown> = { cascade: true }
        if (startChanged) payload.new_start = task.scheduledStartInput || null
        if (endChanged)   payload.new_end   = task.scheduledEndInput   || null
        await api.post(`/tasks/${task.id}/reschedule`, payload, 30000)
      } else {
        await api.put<TaskRecord>(`/tasks/${task.id}`, {
          scheduled_start: task.scheduledStartInput ? `${task.scheduledStartInput}T07:00:00` : null,
          scheduled_end: task.scheduledEndInput ? `${task.scheduledEndInput}T17:00:00` : null,
        })
      }
      setSaveMessage(`Saved "${task.name}"`)
      window.dispatchEvent(new Event(REFRESH_EVENT))
      window.setTimeout(() => setSaveMessage(''), 2500)
      await loadProjectData()
    } catch (err) {
      console.error('Failed to save task:', err)
      setError(err instanceof Error ? err.message : 'Could not save task changes.')
    } finally {
      setSavingTaskId(null)
    }
  }

  function initiateComplete(task: EditableTask) {
    setShowCascadeConfirm(false)
    setPendingTaskUpdate(null)
    setCompleteError('')
    setActualStartInput(task.scheduledStartInput || toDateInput(new Date().toISOString()))
    setActualEndInput(toDateInput(new Date().toISOString()))
    setCompletingTaskId(task.id)
  }

  async function confirmComplete(task: EditableTask) {
    setIsCompleting(true)
    setCompleteError('')

    try {
      const execResponse = await api.post<{ results: { success: boolean; message: string }[] }>(
        '/execute',
        {
          actions: [
            {
              intent: 'complete_task',
              task_id: task.id,
              task_name: task.name,
              project_id: projectId,
              project_name: projectTitle,
            },
          ],
        }
      )

      const result = execResponse.results?.[0]
      if (!result?.success) {
        setCompleteError(result?.message || 'Could not mark task complete.')
        return
      }

      if (actualStartInput || actualEndInput) {
        await api.put<TaskRecord>(`/tasks/${task.id}`, {
          actual_start: actualStartInput ? `${actualStartInput}T07:00:00` : null,
          actual_end: actualEndInput ? `${actualEndInput}T17:00:00` : null,
        })
      }

      setCompletingTaskId(null)
      setSaveMessage(`Marked "${task.name}" complete.`)
      window.dispatchEvent(new Event(REFRESH_EVENT))
      window.setTimeout(() => setSaveMessage(''), 2500)
      await loadProjectData()
    } catch (err) {
      console.error('Failed to complete task:', err)
      setCompleteError(err instanceof Error ? err.message : 'Could not mark task complete.')
    } finally {
      setIsCompleting(false)
    }
  }

  async function assignContact(taskId: string, contactId: string, role: string) {
    setIsAssigning(true)
    setAssignError('')
    try {
      await api.post('/assignments/', { task_id: taskId, contact_id: contactId, role })
      setPickerTaskId(null)
      await loadProjectData()
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not assign contact.')
    } finally {
      setIsAssigning(false)
    }
  }

  const projectTitle = project?.name || 'Project'

  const pendingCount = useMemo(
    () => tasks.filter((task) => task.status === 'pending').length,
    [tasks]
  )

  const visibleTasks = useMemo(
    () => hideCompleted ? tasks.filter((task) => task.status !== 'completed') : tasks,
    [tasks, hideCompleted]
  )

  const pickerTask = pickerTaskId ? (tasks.find(t => t.id === pickerTaskId) ?? null) : null
  const pickerCat = pickerTask?.category?.toLowerCase().trim() || null
  const pickerContacts = pickerTask
    ? allContacts.filter(c => {
        const ct = c.trade?.toLowerCase().trim() || null
        return !pickerCat || (!!ct && ct === pickerCat)
      })
    : []

  if (loading) {
    return (
      <>
        <PageHeader title="Project" subtitle="Task View" showBack />
        <div className="px-4 py-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
            <p className="text-sm text-slate-400">Loading project...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={projectTitle} subtitle="Task View" showBack />

      <div className="px-4 py-5 space-y-4">
        <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/12 via-slate-900/80 to-slate-900 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
                Live Project
              </p>
              <h2 className="text-lg font-semibold text-white">{projectTitle}</h2>
              <p className="mt-1 text-sm text-slate-300">
                Update task dates and issue commands inside this project context.
              </p>
            </div>

            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${getProjectStatusClasses(project?.status)}`}
            >
              {formatStatusLabel(project?.status)}
            </span>
          </div>

          {error && (
            <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2">
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {saveMessage && (
            <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
              <p className="text-xs text-emerald-300">{saveMessage}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-slate-400">Start Date</p>
              <p className="mt-1 font-medium text-white">
                {formatProjectDate(project?.start_date)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-slate-400">Tasks</p>
              <p className="mt-1 font-medium text-white">
                {tasks.length} total / {pendingCount} pending
              </p>
            </div>

            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-slate-400">Address</p>
              <p className="mt-1 font-medium text-white">{project?.address || '—'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Job Details
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-24 flex-shrink-0 text-xs text-slate-400">Job #</span>
              <span className="text-sm font-medium text-white">{project?.name || '—'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-24 flex-shrink-0 text-xs text-slate-400">Address</span>
              <span className="text-sm font-medium text-white">{project?.address || '—'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-24 flex-shrink-0 text-xs text-slate-400">Status</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${getProjectStatusClasses(project?.status)}`}>
                {formatStatusLabel(project?.status)}
              </span>
            </div>
            {project?.start_date && (
              <div className="flex items-start gap-2">
                <span className="w-24 flex-shrink-0 text-xs text-slate-400">Start Date</span>
                <span className="text-sm font-medium text-white">{formatProjectDate(project.start_date)}</span>
              </div>
            )}
            {project?.description && (
              <div className="border-t border-white/10 pt-2">
                <p className="mb-1 text-xs text-slate-400">Project Details</p>
                <p className="whitespace-pre-line text-sm text-slate-200">{project.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="sticky top-16 z-[25] bg-slate-950/95 backdrop-blur-sm -mx-4 px-4 py-2">
          <CommandBar
            placeholder="Type a command for this project..."
            currentProjectId={projectId}
            currentProjectName={projectTitle}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Tasks
            </p>
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="accent-orange-500"
              />
              Hide completed
            </label>
          </div>

          {visibleTasks.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 shadow-sm">
              <p className="text-sm text-slate-400">No tasks found for this project.</p>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <div
                key={task.id}
                className="space-y-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/5">
                    {task.status === 'completed' ? (
                      <CheckCircle size={18} className="text-emerald-400" />
                    ) : task.status === 'in_progress' ? (
                      <Clock size={18} className="text-blue-400" />
                    ) : task.status === 'pending' ? (
                      <Circle size={18} className="text-slate-500" />
                    ) : (
                      <AlertCircle size={18} className="text-amber-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{task.name}</p>

                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <span className={`flex items-center gap-1 text-xs ${getTaskStatusClasses(task.status)}`}>
                        <Clock size={11} />
                        {formatStatusLabel(task.status)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <User size={11} />
                        Task ID: {task.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="mt-2">
                      {(assignmentMap[task.id]?.length ?? 0) > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {assignmentMap[task.id].map((a, i) => (
                            <button
                              key={i}
                              onClick={() => { setPickerTaskId(task.id); setPickerRole('lead'); setAssignError('') }}
                              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors text-left"
                            >
                              <User size={10} className="flex-shrink-0 text-orange-300/60" />
                              <span>{a.name}</span>
                              {a.company && <span className="text-slate-500">· {a.company}</span>}
                              <span className="text-slate-500">· {a.role}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setPickerTaskId(task.id); setPickerRole('lead'); setAssignError('') }}
                          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-400 transition-colors"
                        >
                          <User size={10} className="flex-shrink-0" />
                          No contacts assigned — tap to assign
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Start</p>
                    <input
                      type="date"
                      value={task.scheduledStartInput}
                      onChange={(e) =>
                        updateTaskInput(task.id, { scheduledStartInput: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-orange-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">End</p>
                    <input
                      type="date"
                      value={task.scheduledEndInput}
                      onChange={(e) =>
                        updateTaskInput(task.id, { scheduledEndInput: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-orange-400"
                    />
                  </div>
                </div>

                {completingTaskId === task.id && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 space-y-3">
                    <p className="text-sm font-semibold text-white">Mark &ldquo;{task.name}&rdquo; complete?</p>
                    <p className="text-xs text-slate-300">Optionally set actual start and end dates, then confirm.</p>

                    {completeError && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                        <p className="whitespace-pre-line text-xs text-red-300">{completeError}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">Actual Start</p>
                        <input
                          type="date"
                          value={actualStartInput}
                          onChange={(e) => setActualStartInput(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">Actual End</p>
                        <input
                          type="date"
                          value={actualEndInput}
                          onChange={(e) => setActualEndInput(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => void confirmComplete(task)}
                        disabled={isCompleting}
                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isCompleting ? 'Saving...' : 'Confirm Complete'}
                      </button>
                      <button
                        onClick={() => { setCompletingTaskId(null); setCompleteError('') }}
                        disabled={isCompleting}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {showCascadeConfirm && pendingTaskUpdate?.id === task.id && (
                  <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-4 space-y-3">
                    <p className="text-sm font-semibold text-white">Move the rest of the schedule out?</p>
                    <p className="text-xs text-slate-300">
                      Saving <span className="font-medium text-white">&ldquo;{pendingTaskUpdate.name}&rdquo;</span> — do you want to shift all later tasks by the same number of days?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmCascade(true)}
                        className="flex-1 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => confirmCascade(false)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  {task.status !== 'completed' && (
                    <button
                      onClick={() => initiateComplete(task)}
                      disabled={savingTaskId === task.id || isCompleting}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle size={13} />
                      Mark Complete
                    </button>
                  )}
                  <button
                    onClick={() => saveTaskDates(task)}
                    disabled={savingTaskId === task.id}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={13} />
                    {savingTaskId === task.id ? 'Saving...' : 'Save Dates'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {pickerTask && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPickerTaskId(null)}
        >
          <div
            className="mx-4 w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-slate-900"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-300/80">Assign Contact</p>
                <p className="truncate text-sm font-semibold text-white">{pickerTask.name}</p>
              </div>
              <button
                onClick={() => setPickerTaskId(null)}
                className="ml-3 flex-shrink-0 text-slate-400 transition-colors hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Role</p>
              <div className="flex flex-wrap gap-2">
                {(['lead', 'support', 'supplier', 'consulted', 'inspector'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setPickerRole(r)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      pickerRole === r
                        ? 'bg-orange-500 text-white'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 px-5 py-4 pb-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {pickerCat ? `Contacts — ${pickerTask.category}` : 'All Contacts'}
              </p>

              {assignError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-300">{assignError}</p>
                </div>
              )}

              {pickerContacts.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  No contacts match this task&apos;s trade. Add or update contacts from the Contacts tab.
                </p>
              ) : (
                pickerContacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => void assignContact(pickerTask.id, c.id, pickerRole)}
                    disabled={isAssigning}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10 disabled:opacity-50"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/5">
                      <User size={16} className="text-orange-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                      {c.company && <p className="truncate text-xs text-slate-400">{c.company}</p>}
                      {c.trade && <p className="truncate text-[11px] text-slate-500">{c.trade}</p>}
                    </div>
                    {isAssigning && <span className="flex-shrink-0 text-xs text-slate-500">Saving…</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
