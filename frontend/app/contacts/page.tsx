'use client'

import { useRouter } from 'next/navigation'
import { User, MessageSquare, Mail, Phone, ChevronRight, Upload, Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

// Placeholder contacts — replaced with API calls in Module 4
const placeholderContacts = [
  { name: 'Bob Crane', company: 'Crane Electrical Pty Ltd', type: 'Subcontractor', method: 'sms' },
  { name: 'Sarah Builds', company: 'SB Concrete', type: 'Subcontractor', method: 'email' },
  { name: 'Mike Frame', company: 'Frame Co.', type: 'Supplier', method: 'phone' },
]

const methodIcon = {
  sms: MessageSquare,
  email: Mail,
  phone: Phone,
}

const typeStyles: Record<string, string> = {
  Subcontractor: 'border border-blue-400/20 bg-blue-500/10 text-blue-300',
  Supplier: 'border border-purple-400/20 bg-purple-500/10 text-purple-300',
  Employee: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
}

export default function ContactsPage() {
  const router = useRouter()
  return (
    <>
      <PageHeader title="Contacts" subtitle="Subcontractors & suppliers" />

      <div className="px-4 py-5 space-y-4">
        <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/12 via-slate-900/80 to-slate-900 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            Communications Hub
          </p>
          <h2 className="text-lg font-semibold text-white">Contact Directory</h2>
          <p className="mt-1 text-sm text-slate-300">
            View key subcontractors, suppliers, and preferred communication paths.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              disabled
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-500 opacity-60"
            >
              <Plus size={18} />
              Add Contact
            </button>
            <button
              onClick={() => router.push('/contacts/csv')}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-500/15 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/25 transition-colors"
            >
              <Upload size={18} />
              Import CSV
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Contacts (placeholder)
            </p>
            <p className="text-xs text-slate-500">{placeholderContacts.length} loaded</p>
          </div>

          {placeholderContacts.map((contact, i) => {
            const MethodIcon = methodIcon[contact.method as keyof typeof methodIcon]

            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/5">
                  <User size={18} className="text-orange-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{contact.name}</p>
                  <p className="truncate text-xs text-slate-400">{contact.company}</p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${typeStyles[contact.type]}`}
                  >
                    {contact.type}
                  </span>
                  <MethodIcon size={14} className="text-slate-500" />
                  <ChevronRight size={15} className="text-slate-600" />
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
          <p className="text-xs text-slate-500">
            Live contacts and communication preferences in Module 4
          </p>
        </div>
      </div>
    </>
  )
}