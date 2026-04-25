'use client'

import { useState } from 'react'
import { User, X, Plus } from 'lucide-react'
import ContactPicker from '@/components/ContactPicker'
import type { TaskDraft, ContactDraft, AssignmentDraft } from '@/lib/types'

interface Props {
  tasks: TaskDraft[]
  contacts: ContactDraft[]
  onBack: () => void
  onNext: (tasks: TaskDraft[]) => void
}

type PickerTarget = { taskTempId: string; role: 'lead' | 'supplier' }

export default function StepAssignContacts({ tasks: initial, contacts: initialContacts, onBack, onNext }: Props) {
  const [tasks, setTasks] = useState<TaskDraft[]>(initial)

  // Local contact list grows as Jeff adds new contacts, so they appear in subsequent pickers
  const [contactList, setContactList] = useState<ContactDraft[]>(initialContacts)

  const [picker, setPicker] = useState<PickerTarget | null>(null)

  function getAssignment(task: TaskDraft, role: 'lead' | 'supplier'): AssignmentDraft | undefined {
    return task.assignments.find(a => a.role === role)
  }

  function handleSelect(contact: ContactDraft) {
    if (!picker) return

    // If new contact, add to local list so other pickers can see it
    if (contact.isNew && !contactList.find(c => c.name === contact.name)) {
      setContactList(prev => [...prev, contact])
    }

    setTasks(prev =>
      prev.map(t => {
        if (t.tempId !== picker.taskTempId) return t
        const filtered = t.assignments.filter(a => a.role !== picker.role)
        return { ...t, assignments: [...filtered, { contact, role: picker.role }] }
      })
    )
    setPicker(null)
  }

  function removeAssignment(taskTempId: string, role: 'lead' | 'supplier') {
    setTasks(prev =>
      prev.map(t =>
        t.tempId === taskTempId
          ? { ...t, assignments: t.assignments.filter(a => a.role !== role) }
          : t
      )
    )
  }

  return (
    <div className="px-4 py-5 space-y-4">

      <p className="text-xs text-gray-400">
        Assign a subcontractor and/or supplier to each task. You can skip and assign later.
      </p>

      {tasks.map(task => {
        const lead = getAssignment(task, 'lead')
        const supplier = getAssignment(task, 'supplier')

        return (
          <div key={task.tempId} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-gray-900">{task.name}</p>

            {/* Subcontractor slot */}
            {lead ? (
              <div className="flex items-center justify-between bg-blue-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <User size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-blue-800 truncate">{lead.contact.name}</span>
                  <span className="text-xs text-blue-400 flex-shrink-0">Sub</span>
                  {lead.contact.isNew && <span className="text-xs text-green-500 flex-shrink-0">new</span>}
                </div>
                <button onClick={() => removeAssignment(task.tempId, 'lead')} className="ml-2 text-blue-300 hover:text-blue-600 flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPicker({ taskTempId: task.tempId, role: 'lead' })}
                className="w-full flex items-center gap-2 border border-dashed border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                <Plus size={14} /> Assign subcontractor
              </button>
            )}

            {/* Supplier slot */}
            {supplier ? (
              <div className="flex items-center justify-between bg-purple-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <User size={14} className="text-purple-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-purple-800 truncate">{supplier.contact.name}</span>
                  <span className="text-xs text-purple-400 flex-shrink-0">Supplier</span>
                  {supplier.contact.isNew && <span className="text-xs text-green-500 flex-shrink-0">new</span>}
                </div>
                <button onClick={() => removeAssignment(task.tempId, 'supplier')} className="ml-2 text-purple-300 hover:text-purple-600 flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPicker({ taskTempId: task.tempId, role: 'supplier' })}
                className="w-full flex items-center gap-2 border border-dashed border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors"
              >
                <Plus size={14} /> Assign supplier
              </button>
            )}
          </div>
        )
      })}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600">
          Back
        </button>
        <button onClick={() => onNext(tasks)} className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold">
          Next: Review
        </button>
      </div>

      {picker && (
        <ContactPicker
          contacts={contactList}
          role={picker.role}
          onSelect={handleSelect}
          onClose={() => setPicker(null)}
        />
      )}

    </div>
  )
}
