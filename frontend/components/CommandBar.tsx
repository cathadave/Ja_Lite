'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Mic, Send } from 'lucide-react'
import { api } from '@/lib/api'
import { rebuildSummary, composeNotifyMessage } from '@/lib/actionSummary'
import ActionPlanSheet from '@/components/ActionPlanSheet'
import type { CommandParseResponse, ParsedAction } from '@/lib/types'

interface CommandBarProps {
  placeholder?: string
  currentProjectId?: string
  currentProjectName?: string
}

interface ExecutionFeedback {
  type: 'success' | 'warning' | 'error'
  message: string
}

const REFRESH_EVENT = 'ja-lite:activity-refresh'

export default function CommandBar({
  placeholder = 'Type a command or tap the mic...',
  currentProjectId,
  currentProjectName,
}: CommandBarProps) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [result, setResult] = useState<CommandParseResponse | null>(null)
  const [modifiedResult, setModifiedResult] = useState<CommandParseResponse | null>(null)
  const [executionMessage, setExecutionMessage] = useState('')
  const [executionFeedback, setExecutionFeedback] = useState<ExecutionFeedback | null>(null)
  const [blockedModal, setBlockedModal] = useState<{
    blockedNames: string[]
    prereqActions: ParsedAction[]
    message?: string
  } | null>(null)
  const [prereqActionsState, setPrereqActionsState] = useState<ParsedAction[] | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  function applyProjectContext(response: CommandParseResponse): CommandParseResponse {
    const updatedActions = response.actions.map((action) => {
      const isProjectMissing =
        action.project_id === null ||
        action.project_id === undefined ||
        action.project_id === ''

      if (currentProjectId) {
        if (!isProjectMissing) return action

        const updatedAmbiguities = (action.ambiguities || []).filter(
          (amb) => !amb.toLowerCase().includes('project')
        )

        const filteredCandidates = (action.task_candidates ?? []).filter(
          (c) => !c.project_id || c.project_id === currentProjectId
        )

        const resolvedTaskId = action.task_id ??
          (filteredCandidates.length === 1 ? filteredCandidates[0].id : null)
        const resolvedTaskName = action.task_name ??
          (filteredCandidates.length === 1 ? filteredCandidates[0].name : null)
        const resolvedAmbiguities = resolvedTaskId
          ? updatedAmbiguities.filter((a) => !a.toLowerCase().includes('multiple tasks'))
          : updatedAmbiguities

        const patched: ParsedAction = {
          ...action,
          project_id: currentProjectId,
          project_name: currentProjectName ?? action.project_name,
          task_id: resolvedTaskId,
          task_name: resolvedTaskName,
          ambiguities: resolvedAmbiguities,
          confidence: resolvedAmbiguities.length === 0 ? 'high' : action.confidence,
          task_candidates: filteredCandidates.length === 1 ? [] : filteredCandidates,
        }

        return { ...patched, summary: rebuildSummary(patched) }
      }

      if (action.intent === 'notify_contacts' && isProjectMissing) {
        const existingAmbiguities = action.ambiguities || []
        const hasProjectAmbiguity = existingAmbiguities.some((amb) =>
          amb.toLowerCase().includes('project')
        )

        return {
          ...action,
          confidence: 'low',
          ambiguities: hasProjectAmbiguity
            ? existingAmbiguities
            : [...existingAmbiguities, 'Project not specified.'],
        }
      }

      return action
    })

    const hasLowConfidence = updatedActions.some(
      (action) => action.confidence === 'low' || (action.ambiguities?.length || 0) > 0
    )

    let clarifyingQuestion = response.clarifying_question || null

    if (!currentProjectId) {
      const needsProjectSelection = updatedActions.some(
        (action) =>
          action.intent === 'notify_contacts' &&
          (!action.project_id || action.project_id === '') &&
          (action.ambiguities || []).some((amb) => amb.toLowerCase().includes('project'))
      )

      if (needsProjectSelection) {
        clarifyingQuestion = 'Which project does this apply to?'
      }
    } else if (
      clarifyingQuestion &&
      clarifyingQuestion.toLowerCase().includes('project')
    ) {
      clarifyingQuestion = null
    }

    return {
      ...response,
      actions: updatedActions,
      has_low_confidence: hasLowConfidence,
      clarifying_question: clarifyingQuestion,
    }
  }

  // Compose professional outbound messages for notify_contacts actions.
  // Runs once per parse, before the confirmation sheet opens.
  // Looks up sibling reschedule actions to pull task/date context into the
  // notify message even when that context lives on a different action in the
  // same command (e.g. "move X to May 25 and notify all contacts").
  function enrichNotifyMessages(response: CommandParseResponse): CommandParseResponse {
    const hasNotify = response.actions.some((a) => a.intent === 'notify_contacts')
    if (!hasNotify) return response

    const rescheduleActions = response.actions.filter(
      (a) => a.intent === 'reschedule_task'
    )

    const enrichedActions = response.actions.map((action) => {
      if (action.intent !== 'notify_contacts') return action

      // Prefer a reschedule action on the same project; fall back to the only
      // reschedule if exactly one exists (common in simple compound commands).
      const sibling =
        rescheduleActions.find(
          (r) => r.project_id && r.project_id === action.project_id
        ) ??
        (rescheduleActions.length === 1 ? rescheduleActions[0] : undefined)

      return {
        ...action,
        message: composeNotifyMessage(action, sibling),
      }
    })

    return { ...response, actions: enrichedActions }
  }

  async function submitRawInput(rawInput: string) {
    const trimmed = rawInput.trim()
    if (!trimmed || parsing) return

    setParsing(true)
    setParseError('')
    setExecutionMessage('')
    setExecutionFeedback(null)

    try {
      const response = await api.post<CommandParseResponse>('/commands/parse', {
        raw_input: trimmed,
        ...(currentProjectId ? { project_id: currentProjectId } : {}),
      })

      const hydratedResponse = applyProjectContext(response)
      const enrichedResponse = enrichNotifyMessages(hydratedResponse)
      setResult(enrichedResponse)
      setModifiedResult(null)
      setText('')
    } catch {
      setParseError('Could not parse command. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  async function handleSubmit() {
    await submitRawInput(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void handleSubmit()
    }
  }

  function handleVoice() {
    const SpeechRecognition =
      (window as Window & {
        SpeechRecognition?: any
        webkitSpeechRecognition?: any
      }).SpeechRecognition ??
      (window as Window & {
        SpeechRecognition?: any
        webkitSpeechRecognition?: any
      }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome on Android or desktop.')
      return
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      setParseError('')
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognition.onerror = () => {
      setListening(false)
      setParseError('Voice recognition failed. Please try again.')
    }

    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || ''
      if (!transcript) {
        setListening(false)
        return
      }

      setText(transcript)
      void submitRawInput(transcript)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function handleClose() {
    setResult(null)
    setModifiedResult(null)
    setParseError('')
    setExecutionMessage('')
    setExecutionFeedback(null)
    setPrereqActionsState(null)
  }

  async function handleConfirm() {
    const currentResult = modifiedResult || result
    if (!currentResult) return

    setExecutionMessage('Executing...')
    setExecutionFeedback(null)
    setBlockedModal(null)
    setPrereqActionsState(null)

    try {
      const data = await api.post<{ results: { success: boolean; intent: string; message?: string; blocked_by?: { id: string; name: string }[] }[] }>('/execute', {
        actions: currentResult.actions,
      })

      const results = data.results || []
      const successCount = results.filter((r) => r.success).length
      const totalCount = results.length
      const failed = results.filter((r) => !r.success)

      if (successCount === totalCount) {
        setExecutionMessage(
          totalCount === 1
            ? 'Action executed successfully'
            : `${totalCount} actions executed successfully`
        )
        setExecutionFeedback({
          type: 'success',
          message:
            totalCount === 1
              ? 'Action executed successfully.'
              : `${totalCount} actions executed successfully.`,
        })
        setResult(null)
        setModifiedResult(null)
        window.dispatchEvent(new Event(REFRESH_EVENT))
        setTimeout(() => {
          setExecutionMessage('')
          setExecutionFeedback(null)
        }, 2000)
        return
      }

      const failureMessages = failed
        .map((r) => {
          const base = `• ${r.message || r.intent}`
          if (r.blocked_by?.length) {
            return `${base}\n  Complete first: ${r.blocked_by.map((b) => b.name).join(', ')}`
          }
          return base
        })
        .filter(Boolean)
        .join('\n')

      const allBlocked = failed.every((r) => (r.blocked_by?.length ?? 0) > 0)

      const seenPrereqIds = new Set<string>()
      const prereqActions: ParsedAction[] = []

      results.forEach((r, i) => {
        if (!r.success && r.intent === 'complete_task' && r.blocked_by?.length) {
          const originAction = currentResult.actions[i]
          const projectId = originAction?.project_id ?? null
          const projectName = originAction?.project_name ?? null

          for (const prereq of r.blocked_by) {
            if (!seenPrereqIds.has(prereq.id)) {
              seenPrereqIds.add(prereq.id)
              prereqActions.push({
                intent: 'complete_task',
                task_id: prereq.id,
                task_name: prereq.name,
                project_id: projectId,
                project_name: projectName,
                contact_id: null,
                contact_name: null,
                new_date: null,
                date_shift: null,
                notify_affected: false,
                channel: null,
                message: null,
                template_name: null,
                task_candidates: [],
                contact_candidates: [],
                confidence: 'high',
                ambiguities: [],
                requires_confirmation: true,
                summary: `Mark '${prereq.name}' as completed.`,
              })
            }
          }
        }
      })

      const hasPrereqMessage = failed.some(
        (r) => r.intent === 'complete_task' && /prerequisite/i.test(r.message ?? '')
      )

      if ((allBlocked && prereqActions.length > 0) || hasPrereqMessage) {
        setExecutionFeedback({
          type: 'error',
          message: `Hold up — this task can't be completed yet\n\n${failureMessages}`,
        })
        setExecutionMessage('')
        if (prereqActions.length > 0) setPrereqActionsState(prereqActions)
      } else {
        setExecutionMessage(`${failed.length} of ${totalCount} actions failed`)
        setExecutionFeedback({
          type: allBlocked ? 'error' : 'warning',
          message:
            failureMessages ||
            `${failed.length} of ${totalCount} actions failed. Review and reconfirm if needed.`,
        })
        if (prereqActions.length > 0) {
          setResult({
            raw_input: '(suggested prerequisite recovery)',
            actions: prereqActions,
            has_low_confidence: false,
            clarifying_question: null,
          })
          setModifiedResult(null)
        }
      }
    } catch {
      setExecutionMessage('Execution failed')
      setExecutionFeedback({
        type: 'error',
        message: 'Execution failed. Please review the command and try again.',
      })
    }
  }

  return (
    <>
      <div className="space-y-2">
        {currentProjectId && (
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Project Context Active
            </p>
            <p className="mt-1 text-sm text-blue-100">
              Commands here will use project{' '}
              <span className="font-semibold">{currentProjectName || currentProjectId}</span>.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={parsing}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
          />

          <button
            onClick={handleVoice}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
            className={`rounded-full p-2 transition-colors ${
              listening
                ? 'bg-red-500/15 text-red-300 animate-pulse'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <Mic size={18} />
          </button>

          <button
            onClick={() => void handleSubmit()}
            disabled={!text.trim() || parsing}
            aria-label="Send command"
            className="rounded-full bg-orange-500 p-2 text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {parsing ? (
              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        {parseError && (
          <p className="text-center text-xs text-red-300">{parseError}</p>
        )}

        {executionMessage && (
          <p className={`mt-2 whitespace-pre-line text-center text-xs ${executionFeedback?.type === 'success' || !executionFeedback ? 'text-emerald-300' : 'text-red-300'}`}>
            {executionMessage}
          </p>
        )}
      </div>

      {result && (
        <ActionPlanSheet
          result={modifiedResult || result}
          onConfirm={handleConfirm}
          onClose={handleClose}
          onUpdateResult={setModifiedResult}
          executionFeedback={executionFeedback}
        />
      )}

      {prereqActionsState && executionFeedback?.type === 'error' && createPortal(
        <div className="fixed bottom-24 left-0 right-0 z-[150] mx-auto max-w-md px-4">
          <button
            onClick={() => {
              setResult({
                raw_input: '(suggested prerequisite recovery)',
                actions: prereqActionsState,
                has_low_confidence: false,
                clarifying_question: null,
              })
              setModifiedResult(null)
              setPrereqActionsState(null)
              setExecutionFeedback(null)
            }}
            className="w-full rounded-2xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-xl transition-colors hover:bg-orange-600"
          >
            Complete prerequisites first
          </button>
        </div>,
        document.body
      )}

      {blockedModal && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4"
          onClick={() => { setBlockedModal(null); handleClose() }}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-red-500/15">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
                  Blocked
                </p>
                <h2 className="mt-0.5 text-base font-bold text-white">
                  Hold up — this task can't be completed yet
                </h2>
              </div>
            </div>

            {blockedModal.message && (
              <p className="mb-3 whitespace-pre-line rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {blockedModal.message}
              </p>
            )}

            <p className="mb-3 text-sm text-slate-300">Complete these tasks first:</p>
            <ul className="mb-6 space-y-2">
              {blockedModal.blockedNames.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                  {name}
                </li>
              ))}
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => { setBlockedModal(null); handleClose() }}
                className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const actions = blockedModal.prereqActions
                  setBlockedModal(null)
                  setResult({
                    raw_input: '(suggested prerequisite recovery)',
                    actions,
                    has_low_confidence: false,
                    clarifying_question: null,
                  })
                  setModifiedResult(null)
                }}
                className="flex-1 rounded-2xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
              >
                Complete prerequisites first
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
