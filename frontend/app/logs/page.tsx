'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { api } from '@/lib/api'

interface ExecutionLog {
  id: string
  intent: string
  success: boolean
  message: string
  project_id?: string | null
  task_id?: string | null
  contact_id?: string | null
  created_at: string
}

const REFRESH_EVENT = 'ja-lite:activity-refresh'
const filters = ['All', 'Projects', 'Tasks', 'Comms']

const intentLabels: Record<string, string> = {
  reschedule_task: 'Reschedule Task',
  notify_contacts: 'Notify Contacts',
  reassign_task: 'Reassign Task',
  create_project: 'Create Project',
  query_schedule: 'Query Schedule',
}

function normalizeTimestamp(dateStr: string): Date {
  if (!dateStr) return new Date()

  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(dateStr)
  const normalized = hasTimezone ? dateStr : `${dateStr}Z`

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return new Date()
  }

  return date
}

function sortLogsNewestFirst(logs: ExecutionLog[]): ExecutionLog[] {
  return [...logs].sort((a, b) => {
    const aTime = normalizeTimestamp(a.created_at).getTime()
    const bTime = normalizeTimestamp(b.created_at).getTime()
    return bTime - aTime
  })
}

function extractLogs(response: unknown): ExecutionLog[] {
  if (Array.isArray(response)) {
    return response as ExecutionLog[]
  }

  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    Array.isArray((response as { data?: unknown }).data)
  ) {
    return (response as { data: ExecutionLog[] }).data
  }

  return []
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError('')

    try {
      const cacheBuster = Date.now()
      const response = await api.get<ExecutionLog[] | { data: ExecutionLog[] }>(
        `/logs/execution?limit=50&_ts=${cacheBuster}`
      )

      const rawLogs = extractLogs(response)
      const nextLogs = sortLogsNewestFirst(rawLogs)
      setLogs(nextLogs)
    } catch (err) {
      console.error('Failed to fetch execution logs:', err)
      setLogs([])
      setError(err instanceof Error ? err.message : 'Could not load activity log.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    function handleRefresh() {
      fetchLogs(false)
    }

    function handleFocus() {
      fetchLogs(false)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchLogs(false)
      }
    }

    function handlePageShow() {
      fetchLogs(false)
    }

    fetchLogs(true)

    window.addEventListener(REFRESH_EVENT, handleRefresh)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener(REFRESH_EVENT, handleRefresh)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchLogs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      switch (activeFilter) {
        case 'Projects':
          return log.project_id !== null && log.project_id !== undefined
        case 'Tasks':
          return log.task_id !== null && log.task_id !== undefined
        case 'Comms':
          return log.intent === 'notify_contacts'
        default:
          return true
      }
    })
  }, [logs, activeFilter])

  const formatDate = (dateStr: string) => {
    try {
      const date = normalizeTimestamp(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return 'Just now'
    }
  }

  const formatFullDate = (dateStr: string) => {
    try {
      const date = normalizeTimestamp(dateStr)

      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const getDotColor = (log: ExecutionLog): string => {
    if (log.project_id) return 'bg-blue-400'
    if (log.task_id) return 'bg-emerald-400'
    if (log.intent === 'notify_contacts') return 'bg-purple-400'
    return log.success ? 'bg-slate-300' : 'bg-amber-400'
  }

  return (
    <>
      <PageHeader title="Activity Log" subtitle="All changes and communications" />

      <div className="px-4 py-5 space-y-4">
        <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/12 via-slate-900/80 to-slate-900 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
            System Intelligence
          </p>
          <h2 className="text-lg font-semibold text-white">Execution Timeline</h2>
          <p className="mt-1 text-sm text-slate-300">
            Review live actions, project updates, task changes, and communication events.
          </p>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex-shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === filter
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-sm">
          {loading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Loading...</p>
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-red-300">Could not load activity log.</p>
              <p className="mt-1 text-xs text-slate-500">{error}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">No activity for this filter.</p>
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={log.id}>
                <button
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                    i < filteredLogs.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${getDotColor(log)}`} />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {intentLabels[log.intent] || log.intent}
                    </p>
                    <p className="mt-0.5 line-clamp-1 whitespace-pre-line text-xs text-slate-400">{log.message}</p>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1 text-xs text-slate-500">
                    <Calendar size={11} />
                    {formatDate(log.created_at)}
                  </div>
                </button>

                {expandedId === log.id && (
                  <div className="space-y-3 border-t border-white/10 bg-slate-950/40 px-4 py-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="font-semibold text-slate-400">Intent</p>
                        <p className="mt-1 text-white">{log.intent}</p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="font-semibold text-slate-400">Status</p>
                        <p className={`mt-1 ${log.success ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {log.success ? 'Success' : 'Failed'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="font-semibold text-slate-400">Message</p>
                      <p className="mt-1 whitespace-pre-line text-slate-200">{log.message}</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="font-semibold text-slate-400">Timestamp</p>
                      <p className="mt-1 text-slate-200">{formatFullDate(log.created_at)}</p>
                    </div>

                    {(log.project_id || log.task_id || log.contact_id) && (
                      <div className="grid grid-cols-2 gap-3">
                        {log.project_id && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="font-semibold text-slate-400">Project ID</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-200">
                              {log.project_id}
                            </p>
                          </div>
                        )}

                        {log.task_id && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="font-semibold text-slate-400">Task ID</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-200">
                              {log.task_id}
                            </p>
                          </div>
                        )}

                        {log.contact_id && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="font-semibold text-slate-400">Contact ID</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-200">
                              {log.contact_id}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}