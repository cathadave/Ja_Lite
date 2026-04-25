'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { TaskDraft } from '@/lib/types'

interface Props {
  tasks: TaskDraft[]
  projectStartDate: string
  onBack: () => void
  onNext: (tasks: TaskDraft[]) => void
}

export default function StepTaskReview({ tasks: initial, projectStartDate, onBack, onNext }: Props) {
  const [tasks, setTasks] = useState<TaskDraft[]>(initial)
  const [error, setError] = useState('')

  function addTask() {
    setTasks(prev => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        name: '',
        scheduledStart: projectStartDate,
        scheduledEnd: '',
        assignments: [],
      },
    ])
  }

  function remove(tempId: string) {
    setTasks(prev => prev.filter(t => t.tempId !== tempId))
  }

  function update(tempId: string, patch: Partial<TaskDraft>) {
    setTasks(prev => prev.map(t => (t.tempId === tempId ? { ...t, ...patch } : t)))
  }

  function handleNext() {
    if (tasks.length === 0) { setError('Add at least one task.'); return }
    if (tasks.some(t => !t.name.trim())) { setError('All tasks must have a name.'); return }
    setError('')
    onNext(tasks)
  }

  const dateInput = 'w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-white'

  return (
    <div className="px-4 py-5 space-y-3">

      {tasks.map((task, i) => (
        <div key={task.tempId} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">Task {i + 1}</span>
            <button onClick={() => remove(task.tempId)} className="p-1 text-gray-300 hover:text-red-400 transition-colors" aria-label="Remove task">
              <Trash2 size={14} />
            </button>
          </div>

          <input
            type="text"
            value={task.name}
            onChange={e => update(task.tempId, { name: e.target.value })}
            placeholder="Task name *"
            className="w-full border-b border-gray-200 pb-1 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 bg-transparent"
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Start</p>
              <input type="date" value={task.scheduledStart ?? ''} onChange={e => update(task.tempId, { scheduledStart: e.target.value })} className={dateInput} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">End</p>
              <input type="date" value={task.scheduledEnd ?? ''} onChange={e => update(task.tempId, { scheduledEnd: e.target.value })} className={dateInput} />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addTask}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-3 text-sm font-semibold text-gray-400 flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-500 transition-colors"
      >
        <Plus size={15} /> Add Task
      </button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600">Back</button>
        <button onClick={handleNext} className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold">Next: Assign Contacts</button>
      </div>

    </div>
  )
}
