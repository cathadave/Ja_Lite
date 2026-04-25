'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/api'

type CsvRow = {
  name: string
  company: string
  contact_type: string
  phone: string
  email: string
  preferred_contact_method: string
  trade: string
}

type RowResult = {
  name: string
  ok: boolean
  error?: string
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const dataLines = lines[0].toLowerCase().startsWith('name') ? lines.slice(1) : lines
  return dataLines.map(line => {
    const cols = line.split(',').map(c => c.trim())
    const [
      name = '',
      company = '',
      contact_type = '',
      phone = '',
      email = '',
      preferred_contact_method = '',
      trade = '',
    ] = cols
    return { name, company, contact_type, phone, email, preferred_contact_method, trade }
  }).filter(r => r.name)
}

const VALID_TYPES = ['subcontractor', 'supplier', 'employee', 'client', 'other']
const VALID_METHODS = ['sms', 'email', 'phone', 'whatsapp']

export default function ContactCsvImporter() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [results, setResults] = useState<RowResult[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResults([])
    setDone(false)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setRows(parseCsv(text))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setRunning(true)
    setDone(false)
    const out: RowResult[] = []
    for (const row of rows) {
      try {
        await api.post('/contacts/', {
          name: row.name,
          company: row.company || undefined,
          contact_type: VALID_TYPES.includes(row.contact_type) ? row.contact_type : 'other',
          phone: row.phone || undefined,
          email: row.email || undefined,
          preferred_contact_method: VALID_METHODS.includes(row.preferred_contact_method) ? row.preferred_contact_method : 'sms',
          trade: row.trade || undefined,
        })
        out.push({ name: row.name, ok: true })
      } catch (err) {
        out.push({ name: row.name, ok: false, error: err instanceof Error ? err.message : 'failed' })
      }
    }
    setResults(out)
    setRunning(false)
    setDone(true)
  }

  function handleReset() {
    setRows([])
    setResults([])
    setDone(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const succeeded = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-slate-200">Select CSV file</label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="block w-full text-sm text-slate-300"
        />
        <p className="text-xs text-slate-500 mt-1">
          Columns: name, company, contact_type, phone, email, preferred_contact_method, trade
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          contact_type: subcontractor | supplier | employee | client | other
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          preferred_contact_method: sms | email | phone | whatsapp
        </p>
      </div>

      {rows.length > 0 && !done && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-200">
            {rows.length} row{rows.length !== 1 ? 's' : ''} parsed
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left border-b border-white/10 text-slate-400">
                  <th className="py-1 pr-3">Name</th>
                  <th className="py-1 pr-3">Company</th>
                  <th className="py-1 pr-3">Type</th>
                  <th className="py-1 pr-3">Phone</th>
                  <th className="py-1">Method</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 text-slate-300">
                    <td className="py-1 pr-3">{r.name}</td>
                    <td className="py-1 pr-3">{r.company || '—'}</td>
                    <td className="py-1 pr-3">{r.contact_type || '—'}</td>
                    <td className="py-1 pr-3">{r.phone || '—'}</td>
                    <td className="py-1">{r.preferred_contact_method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleImport}
              disabled={running}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-xl font-semibold disabled:opacity-50"
            >
              {running ? 'Importing…' : 'Import Contacts'}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm border border-white/10 rounded-xl text-slate-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-200">
            Done — {succeeded} succeeded, {failed} failed
          </p>
          <ul className="text-xs space-y-1">
            {results.map((r, i) => (
              <li key={i} className={r.ok ? 'text-emerald-400' : 'text-red-400'}>
                {r.ok ? '✓' : '✗'} {r.name}{r.error ? ` — ${r.error}` : ''}
              </li>
            ))}
          </ul>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm border border-white/10 rounded-xl text-slate-300"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
