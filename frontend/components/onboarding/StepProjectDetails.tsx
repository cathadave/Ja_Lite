'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import type { ProjectDetails } from '@/lib/types'

type Template = { id: string; name: string }

interface Props {
  data: ProjectDetails
  onNext: (data: ProjectDetails) => void
}

export default function StepProjectDetails({ data, onNext }: Props) {
  const [form, setForm] = useState<ProjectDetails>(data)
  const [templates, setTemplates] = useState<Template[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectDetails, string>>>({})
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [templateLoadError, setTemplateLoadError] = useState('')

  useEffect(() => {
    setIsLoadingTemplates(true)
    setTemplateLoadError('')

    api
      .get<Template[]>('/templates/')
      .then(data => {
        setTemplates(data)
      })
      .catch(err => {
        console.error('Templates fetch failed:', err)
        setTemplateLoadError('Could not load templates. You can continue without one or retry later.')
      })
      .finally(() => {
        setIsLoadingTemplates(false)
      })
  }, [])

  function set(field: keyof ProjectDetails, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = 'Project name is required.'
    if (!form.startDate) e.startDate = 'Start date is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (!validate()) return
    const tpl = templates.find(t => t.id === form.templateId)
    onNext({ ...form, templateName: tpl?.name ?? '' })
  }

  const field =
    'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400'

  return (
    <div className="px-4 py-5 space-y-5">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Project Name *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Smith Residence"
          className={field}
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Address
        </label>
        <input
          type="text"
          value={form.address}
          onChange={e => set('address', e.target.value)}
          placeholder="e.g. 12 Oak Street, Suburb"
          className={field}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Start Date *
        </label>
        <input
          type="date"
          value={form.startDate}
          onChange={e => set('startDate', e.target.value)}
          className={field}
        />
        {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Template
        </label>
        <div className="relative">
          <select
            value={form.templateId}
            onChange={e => set('templateId', e.target.value)}
            className={`${field} appearance-none pr-9`}
            disabled={isLoadingTemplates}
          >
            <option value="">
              {isLoadingTemplates ? 'Loading templates...' : 'No template — add tasks manually'}
            </option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>

        {templateLoadError ? (
          <p className="text-xs text-red-500">{templateLoadError}</p>
        ) : !isLoadingTemplates && templates.length === 0 ? (
          <p className="text-xs text-gray-400">No templates found. You can add tasks manually.</p>
        ) : null}
      </div>

      <button
        onClick={handleNext}
        className="w-full bg-blue-600 text-white rounded-2xl py-3 text-sm font-semibold"
      >
        Next: Review Tasks
      </button>
    </div>
  )
}