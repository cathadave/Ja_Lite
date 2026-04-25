'use client'

import { AlertTriangle, CheckCircle, HelpCircle, Info } from 'lucide-react'
import type { ParsedAction } from '@/lib/types'

const INTENT_LABELS: Record<ParsedAction['intent'], string> = {
  reschedule_task: 'Reschedule Task',
  notify_contacts: 'Notify Contacts',
  reassign_task: 'Reassign Task',
  create_project: 'Create Project',
  query_schedule: 'Show Schedule',
  compound: 'Multiple Actions',
  unknown: 'Unknown',
}

const INTENT_STYLES: Record<ParsedAction['intent'], string> = {
  reschedule_task: 'border border-blue-400/20 bg-blue-500/10 text-blue-300',
  notify_contacts: 'border border-purple-400/20 bg-purple-500/10 text-purple-300',
  reassign_task: 'border border-orange-400/20 bg-orange-500/10 text-orange-300',
  create_project: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
  query_schedule: 'border border-slate-400/20 bg-slate-500/10 text-slate-300',
  compound: 'border border-indigo-400/20 bg-indigo-500/10 text-indigo-300',
  unknown: 'border border-red-400/20 bg-red-500/10 text-red-300',
}

interface Props {
  action: ParsedAction
}

export default function ActionPlanCard({ action }: Props) {
  const isLow = action.confidence === 'low'
  const hasWarnings = action.ambiguities.length > 0

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white/5 shadow-sm transition-all duration-200 hover:bg-white/[0.07] ${
        isLow ? 'border-amber-400/20' : 'border-white/10'
      }`}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${INTENT_STYLES[action.intent]}`}
        >
          {INTENT_LABELS[action.intent]}
        </span>

        {isLow ? (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-300">
            <AlertTriangle size={12} />
            Needs clarification
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-300">
            <CheckCircle size={12} />
            Ready
          </span>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm font-medium leading-snug text-white">{action.summary}</p>
      </div>

      {(action.project_name ||
        action.task_name ||
        action.contact_name ||
        action.new_date ||
        action.date_shift !== null ||
        action.channel) && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-3">
          {action.project_name && <Detail label="Project" value={action.project_name} />}
          {action.task_name && <Detail label="Task" value={action.task_name} />}
          {action.contact_name && <Detail label="Contact" value={action.contact_name} />}
          {action.notify_affected && !action.contact_name && (
            <Detail label="Notify" value="All affected contacts" />
          )}
          {action.new_date && <Detail label="Date" value={action.new_date} />}
          {action.date_shift !== null && action.date_shift !== undefined && !action.new_date && (
            <Detail
              label="Shift"
              value={`${action.date_shift > 0 ? '+' : ''}${action.date_shift} day(s)`}
            />
          )}
          {action.channel && <Detail label="Channel" value={action.channel} />}
          {action.template_name && <Detail label="Template" value={action.template_name} />}
        </div>
      )}

      {hasWarnings && (
        <div className="mx-4 mb-3 space-y-1 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2.5">
          {action.ambiguities.map((warning, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-200">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 border-t border-white/10 px-4 py-2.5 text-xs text-slate-400">
        {action.requires_confirmation ? (
          <>
            <Info size={11} className="flex-shrink-0" />
            Requires your confirmation before anything changes.
          </>
        ) : (
          <>
            <HelpCircle size={11} className="flex-shrink-0" />
            Read-only — no changes will be made.
          </>
        )}
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-xs text-slate-500">{label}:</span>
      <span className="text-xs font-medium text-slate-200">{value}</span>
    </div>
  )
}