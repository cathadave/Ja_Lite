'use client'

import { CheckCircle, Clock, User, MapPin } from 'lucide-react'
import type { ProjectDetails, TaskDraft } from '@/lib/types'

interface Props {
  project: ProjectDetails
  tasks: TaskDraft[]
  onBack: () => void
  onConfirm: () => void
  saving: boolean
  error?: string
}

export default function StepReview({ project, tasks, onBack, onConfirm, saving, error }: Props) {
  const totalAssignments = tasks.reduce((n, t) => n + t.assignments.length, 0)

  return (
    <div className="px-4 py-5 space-y-4">

      {/* Project summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Project</p>
        <p className="text-base font-bold text-gray-900">{project.name}</p>

        {project.address && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <MapPin size={13} className="flex-shrink-0" />
            {project.address}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-gray-400 pt-1">
          <span className="flex items-center gap-1">
            <Clock size={11} /> {project.startDate}
          </span>
          {project.templateName && (
            <span>Template: {project.templateName}</span>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Tasks ({tasks.length}) · {totalAssignments} assignment{totalAssignments !== 1 ? 's' : ''}
        </p>

        {tasks.map(task => (
          <div key={task.tempId} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle size={15} className="text-gray-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-gray-800 truncate">{task.name}</p>
              </div>
              {task.scheduledStart && (
                <span className="text-xs text-gray-400 flex-shrink-0">{task.scheduledStart}</span>
              )}
            </div>

            {task.assignments.length > 0 ? (
              <div className="mt-2 pl-5 space-y-1">
                {task.assignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <User size={11} className="flex-shrink-0" />
                    <span>{a.contact.name}</span>
                    <span className="text-gray-300">· {a.role}</span>
                    {a.contact.isNew && (
                      <span className="text-green-500 font-medium">new</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 pl-5 text-xs text-gray-300">No assignments</p>
            )}
          </div>
        ))}
      </div>

      {/* Save error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-red-600">Save failed</p>
          <p className="text-xs text-red-500">{error}</p>
          <p className="text-xs text-red-400">Your data is not lost. Tap Confirm &amp; Save to try again.</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          disabled={saving}
          className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={saving}
          className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Confirm & Save'}
        </button>
      </div>

    </div>
  )
}
