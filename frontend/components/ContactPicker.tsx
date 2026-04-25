'use client'

import { useState } from 'react'
import { X, User, Plus, Check } from 'lucide-react'
import type { ContactDraft } from '@/lib/types'

const CONTACT_TYPES = ['subcontractor', 'supplier', 'employee', 'client', 'other'] as const
const PREFERRED_METHODS = ['sms', 'email', 'phone', 'whatsapp'] as const

type NewForm = {
  name: string
  company: string
  phone: string
  email: string
  contactType: typeof CONTACT_TYPES[number]
  preferredMethod: typeof PREFERRED_METHODS[number]
}

interface Props {
  contacts: ContactDraft[]
  role: 'lead' | 'supplier'
  onSelect: (contact: ContactDraft) => void
  onClose: () => void
}

export default function ContactPicker({ contacts, role, onSelect, onClose }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewForm>({
    name: '',
    company: '',
    phone: '',
    email: '',
    contactType: role === 'supplier' ? 'supplier' : 'subcontractor',
    preferredMethod: 'sms',
  })
  const [formError, setFormError] = useState('')

  const roleLabel = role === 'lead' ? 'Subcontractor' : 'Supplier'

  // Filter existing contacts by role type
  const filtered = contacts.filter(c =>
    role === 'supplier' ? c.contactType === 'supplier' : c.contactType !== 'supplier'
  )

  function handleAddNew() {
    if (!form.name.trim()) { setFormError('Name is required.'); return }
    if (!form.phone.trim() && !form.email.trim()) { setFormError('Provide a phone number or email.'); return }
    setFormError('')
    onSelect({
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      contactType: form.contactType,
      preferredMethod: form.preferredMethod,
      isNew: true,
    })
  }

  function set(key: keyof NewForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Assign {roleLabel}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {!showForm ? (
          <div className="p-4 space-y-3 pb-8">
            {/* Existing contacts */}
            {filtered.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Existing Contacts</p>
                {filtered.map((contact, i) => (
                  <button
                    key={contact.id ?? i}
                    onClick={() => onSelect(contact)}
                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 text-left hover:bg-blue-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{contact.name}</p>
                      {contact.company && <p className="text-xs text-gray-400 truncate">{contact.company}</p>}
                    </div>
                    <Check size={15} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No {roleLabel.toLowerCase()}s in contacts yet.</p>
            )}

            {/* Add new */}
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-3 text-sm font-semibold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
            >
              <Plus size={15} /> Add New Contact
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4 pb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">New Contact</p>

            {[
              { label: 'Name *',   key: 'name',    type: 'text',  placeholder: 'Full name' },
              { label: 'Company',  key: 'company', type: 'text',  placeholder: 'Company name' },
              { label: 'Phone',    key: 'phone',   type: 'tel',   placeholder: '04xx xxx xxx' },
              { label: 'Email',    key: 'email',   type: 'email', placeholder: 'email@example.com' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs text-gray-500">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key as keyof NewForm]}
                  onChange={e => set(f.key as keyof NewForm, e.target.value)}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              </div>
            ))}

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Contact Type</label>
              <select
                value={form.contactType}
                onChange={e => set('contactType', e.target.value)}
                className={inputCls}
              >
                {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Preferred Contact Method</label>
              <div className="grid grid-cols-4 gap-2">
                {PREFERRED_METHODS.map(m => (
                  <button
                    key={m}
                    onClick={() => set('preferredMethod', m)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      form.preferredMethod === m
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {formError && <p className="text-xs text-red-500">{formError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowForm(false); setFormError('') }}
                className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                Back
              </button>
              <button
                onClick={handleAddNew}
                className="flex-1 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-semibold"
              >
                Add &amp; Assign
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
