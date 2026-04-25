'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

interface ExecutionLog {
  id: string
  intent: string
  success: boolean
  message: string
  created_at: string
}

const REFRESH_EVENT = 'ja-lite:activity-refresh'

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

export default function RecentActivity() {
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError('')

    try {
      const cacheBuster = Date.now()
      const response = await api.get<ExecutionLog[] | { data: ExecutionLog[] }>(
        `/logs/execution?limit=5&_ts=${cacheBuster}`
      )

      const rawLogs = extractLogs(response)
      const nextLogs = sortLogsNewestFirst(rawLogs)
      setLogs(nextLogs)
    } catch (err) {
      console.error('Failed to fetch execution logs:', err)
      setLogs([])
      setError(err instanceof Error ? err.message : 'Could not load recent activity.')
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

  const formatDate = (dateStr: string) => {
    try {
      const date = normalizeTimestamp(dateStr)

      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Just now'
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        Recent Activity
      </h2>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-sm">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-red-300">Could not load recent activity.</p>
            <p className="mt-1 text-xs text-slate-500">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-400">No recent activity yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                {log.success ? (
                  <CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-400" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{log.intent}</p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-slate-400">{log.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(log.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}