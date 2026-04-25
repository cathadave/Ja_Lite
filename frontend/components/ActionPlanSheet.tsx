'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, MessageCircle, ChevronDown, Sparkles } from 'lucide-react'
import ActionPlanCard from '@/components/ActionPlanCard'
import { api } from '@/lib/api'
import type { CommandParseResponse, ParsedAction, TaskCandidate } from '@/lib/types'

interface Project {
  id: string
  name: string
}

interface Props {
  result: CommandParseResponse
  onConfirm: () => void
  onClose: () => void
  onUpdateResult?: (updatedResult: CommandParseResponse) => void
  executionFeedback?: { type: string; message: string } | null
}

export default function ActionPlanSheet({
  result,
  onConfirm,
  onClose,
  onUpdateResult,
  executionFeedback,
}: Props) {
  const blocked = result.has_low_confidence

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<Record<number, string>>({})
  const [cascadeChoices, setCascadeChoices] = useState<Record<number, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const [overrideAuthorized, setOverrideAuthorized] = useState(false)

  const rescheduleActionsPendingCascade = result.actions.some(
    (action, i) =>
      action.intent === 'reschedule_task' &&
      action.task_id &&
      action.confidence === 'high' &&
      cascadeChoices[i] === undefined
  )
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const isProjectMissing = (action: ParsedAction) =>
    action.project_id === null ||
    action.project_id === undefined ||
    action.project_id === ''

  const clarifyingQuestionMentionsProject = (result.clarifying_question || '')
    .toLowerCase()
    .includes('project')

  const needsProjectClarification =
    result.actions.some((action) => isProjectMissing(action)) &&
    (result.has_low_confidence || clarifyingQuestionMentionsProject)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [mounted])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [result])

  useEffect(() => {
    if (needsProjectClarification && projects.length === 0) {
      setLoadingProjects(true)
      setFetchError(null)

      api.get<unknown>('/projects/')
        .then((response) => {
          let projectArray: Project[] = []

          if (Array.isArray(response)) {
            projectArray = response as Project[]
          } else if (response && typeof response === 'object') {
            const wrapped = response as Record<string, unknown>

            if (Array.isArray(wrapped.projects)) {
              projectArray = wrapped.projects as Project[]
            } else if (Array.isArray(wrapped.data)) {
              projectArray = wrapped.data as Project[]
            } else if (Array.isArray(wrapped.items)) {
              projectArray = wrapped.items as Project[]
            }
          }

          setProjects(projectArray)
        })
        .catch((error) => {
          console.error('ActionPlanSheet project fetch error', error)
          setFetchError(error instanceof Error ? error.message : String(error))
        })
        .finally(() => setLoadingProjects(false))
    }
  }, [needsProjectClarification, projects.length])

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId)

    if (!onUpdateResult) return

    const selectedProject = projects.find((p) => p.id === projectId)
    if (!selectedProject) return

    const updatedActions = result.actions.map((action) => {
      if (isProjectMissing(action)) {
        return {
          ...action,
          project_id: selectedProject.id,
          project_name: selectedProject.name,
          ambiguities: action.ambiguities.filter(
            (amb) => !amb.toLowerCase().includes('project')
          ),
          confidence: 'high' as const,
        }
      }

      return action
    })

    const hasLowConfidence = updatedActions.some(
      (action) => action.confidence === 'low' || action.ambiguities.length > 0
    )

    const updatedResult: CommandParseResponse = {
      ...result,
      actions: updatedActions,
      has_low_confidence: hasLowConfidence,
      clarifying_question: hasLowConfidence ? result.clarifying_question : null,
    }

    onUpdateResult(updatedResult)
  }

  const handleTaskSelect = (actionIndex: number, candidate: TaskCandidate) => {
    setSelectedTaskIds((prev) => ({ ...prev, [actionIndex]: candidate.id }))

    if (!onUpdateResult) return

    const updatedActions = result.actions.map((action, i) => {
      if (i !== actionIndex) return action
      const filteredAmbiguities = (action.ambiguities || []).filter(
        (a) =>
          !a.toLowerCase().includes('multiple tasks') &&
          !a.toLowerCase().startsWith("task '")
      )
      return {
        ...action,
        task_id: candidate.id,
        task_name: candidate.name,
        task_candidates: [],
        ambiguities: filteredAmbiguities,
        confidence:
          filteredAmbiguities.length === 0 && (action.new_date || action.date_shift)
            ? 'high' as const
            : action.confidence,
      }
    })

    const hasLowConfidence = updatedActions.some(
      (action) => action.confidence === 'low' || action.ambiguities.length > 0
    )

    onUpdateResult({
      ...result,
      actions: updatedActions,
      has_low_confidence: hasLowConfidence,
      clarifying_question: hasLowConfidence ? result.clarifying_question : null,
    })
  }

  const handleCascadeChoice = (actionIndex: number, choice: boolean) => {
    setCascadeChoices((prev) => ({ ...prev, [actionIndex]: choice }))

    if (!onUpdateResult) return

    const updatedActions = result.actions.map((action, i) => {
      if (i !== actionIndex) return action
      return { ...action, cascade: choice }
    })

    onUpdateResult({ ...result, actions: updatedActions })
  }

  const projectNames = Array.from(
    new Set(
      result.actions
        .map((action) => action.project_name)
        .filter((value): value is string => Boolean(value))
    )
  )

  const contactNames = Array.from(
    new Set(
      result.actions
        .map((action) => action.contact_name)
        .filter((value): value is string => Boolean(value))
    )
  )

  const taskNames = Array.from(
    new Set(
      result.actions
        .map((action) => action.task_name)
        .filter((value): value is string => Boolean(value))
    )
  )

  const dateTargets = Array.from(
    new Set(
      result.actions
        .map((action) => action.new_date)
        .filter((value): value is string => Boolean(value))
    )
  )

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="mx-auto flex h-[100dvh] w-full max-w-md items-end">
        <div
          className="flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl animate-sheet-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-white/10 bg-slate-950/95">
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            <div className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
                    Command Review
                  </p>
                  <h2 className="text-base font-bold text-white">Action Plan</h2>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    "{result.raw_input}"
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close action plan"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
          >
            <div className="space-y-4 pb-2">
              <div className="rounded-2xl border border-orange-400/20 bg-gradient-to-r from-orange-500/12 to-orange-400/5 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
                    <Sparkles size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/80">
                      Impact Summary
                    </p>
                    <p className="mt-1 text-sm font-medium text-orange-100">
                      {result.actions.length === 1
                        ? '1 action is ready for confirmation.'
                        : `${result.actions.length} actions are ready for confirmation.`}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-slate-500">Projects</p>
                        <p className="mt-0.5 font-medium text-white">
                          {projectNames.length > 0 ? projectNames.join(', ') : '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-slate-500">Contacts</p>
                        <p className="mt-0.5 font-medium text-white">
                          {contactNames.length > 0 ? contactNames.join(', ') : '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-slate-500">Tasks</p>
                        <p className="mt-0.5 font-medium text-white">
                          {taskNames.length > 0 ? taskNames.join(', ') : '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-slate-500">Dates</p>
                        <p className="mt-0.5 font-medium text-white">
                          {dateTargets.length > 0 ? dateTargets.join(', ') : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {result.actions.map((action, i) => (
                <div key={i} className="space-y-2">
                  <ActionPlanCard action={action} />

                  {action.intent === 'reschedule_task' && action.task_id && action.confidence === 'high' && (
                    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 space-y-2">
                      <p className="text-sm font-semibold text-white">Move the rest of the schedule?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCascadeChoice(i, true)}
                          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                            cascadeChoices[i] === true
                              ? 'bg-orange-500 text-white'
                              : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleCascadeChoice(i, false)}
                          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                            cascadeChoices[i] === false
                              ? 'bg-slate-600 text-white'
                              : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}

                  {action.task_candidates && action.task_candidates.length > 1 && !action.task_id && (
                    <div className="space-y-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
                      <p className="text-sm font-medium text-amber-200">Select the task to reschedule:</p>
                      <div className="space-y-1">
                        {action.task_candidates.map((candidate) => (
                          <button
                            key={candidate.id}
                            onClick={() => handleTaskSelect(i, candidate)}
                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              selectedTaskIds[i] === candidate.id
                                ? 'border-orange-400/40 bg-orange-500/15 text-white'
                                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <p className="text-xs font-medium">{candidate.name}</p>
                            {(candidate.scheduled_start || candidate.scheduled_end) && (
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {candidate.scheduled_start ? candidate.scheduled_start.slice(0, 10) : '—'}
                                {' → '}
                                {candidate.scheduled_end ? candidate.scheduled_end.slice(0, 10) : '—'}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {blocked && (
                <div className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="flex-shrink-0 text-amber-300" />
                    <p className="text-sm font-semibold text-amber-200">
                      More information needed
                    </p>
                  </div>

                  {result.clarifying_question && (
                    <div className="flex items-start gap-2">
                      <MessageCircle size={13} className="mt-0.5 flex-shrink-0 text-amber-300" />
                      <p className="text-sm text-amber-100">{result.clarifying_question}</p>
                    </div>
                  )}

                  {needsProjectClarification && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-amber-200">
                        Select Project
                      </label>

                      <div className="relative">
                        <select
                          value={selectedProjectId}
                          onChange={(e) => handleProjectSelect(e.target.value)}
                          disabled={loadingProjects}
                          className="w-full appearance-none rounded-xl border border-amber-400/20 bg-slate-900 px-3 py-3 pr-10 text-sm text-white outline-none transition-colors focus:border-amber-400 disabled:opacity-50"
                        >
                          <option value="">
                            {loadingProjects ? 'Loading projects...' : 'Choose a project'}
                          </option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>

                        <ChevronDown
                          size={16}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-300"
                        />
                      </div>
                    </div>
                  )}

                  {fetchError && (
                    <p className="text-xs text-red-300">
                      Could not load projects. Please try again.
                    </p>
                  )}

                  <p className="text-xs text-amber-300/80">
                    Fix the issues above before confirming.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-white/10 bg-slate-950/95 p-4">
            {executionFeedback && (
              <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 space-y-2">
                <p className="whitespace-pre-line text-xs text-red-300">{executionFeedback.message}</p>
                {executionFeedback.message.includes('Override required') && !overrideAuthorized && (
                  <button
                    onClick={() => {
                      if (!onUpdateResult) return
                      const updatedActions = result.actions.map((action) =>
                        action.intent === 'reschedule_task'
                          ? { ...action, allow_non_business_day: true, override_reason: 'Authorized' }
                          : action
                      )
                      onUpdateResult({ ...result, actions: updatedActions })
                      setOverrideAuthorized(true)
                    }}
                    className="w-full rounded-xl bg-amber-500 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
                  >
                    Authorize Schedule Override
                  </button>
                )}
                {overrideAuthorized && (
                  <p className="text-xs text-green-300">Override authorized — click Confirm to proceed.</p>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>

              <button
                onClick={onConfirm}
                disabled={blocked || rescheduleActionsPendingCascade}
                className="flex-1 rounded-2xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}