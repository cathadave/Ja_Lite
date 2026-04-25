'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/api'

const DEMO_TEMPLATE_ID = '6ad83674-adf7-47ba-9201-879631410bdd'

type CsvRow = {
  name: string
  address: string
  start_date: string
}

type RowResult = {
  name: string
  ok: boolean
  error?: string
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  // Skip header row
  const dataLines = lines[0].toLowerCase().startsWith('name') ? lines.slice(1) : lines
  return dataLines.map(line => {
    const [name = '', address = '', start_date = ''] = line.split(',').map(c => c.trim())
    return { name, address, start_date }
  }).filter(r => r.name && r.start_date)
}

export default function CsvImporter() {
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
        await api.post('/projects/onboard', {
          name: row.name,
          address: row.address || undefined,
          start_date: row.start_date,
          template_id: DEMO_TEMPLATE_ID,
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
        <label className="block text-sm font-medium mb-1">Select CSV file</label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="block w-full text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">Columns: name, address, start_date</p>
      </div>

      {rows.length > 0 && !done && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{rows.length} row{rows.length !== 1 ? 's' : ''} parsed</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-3">Name</th>
                <th className="py-1 pr-3">Address</th>
                <th className="py-1">Start Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 pr-3">{r.name}</td>
                  <td className="py-1 pr-3">{r.address || '—'}</td>
                  <td className="py-1">{r.start_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleImport}
              disabled={running}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
            >
              {running ? 'Importing…' : 'Import Projects'}
            </button>
            <button onClick={handleReset} className="px-4 py-2 text-sm border rounded">
              Clear
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Done — {succeeded} succeeded, {failed} failed
          </p>
          <ul className="text-xs space-y-1">
            {results.map((r, i) => (
              <li key={i} className={r.ok ? 'text-green-700' : 'text-red-600'}>
                {r.ok ? '✓' : '✗'} {r.name}{r.error ? ` — ${r.error}` : ''}
              </li>
            ))}
          </ul>
          <button onClick={handleReset} className="px-4 py-2 text-sm border rounded">
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
