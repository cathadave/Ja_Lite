'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import RecentActivity from '@/components/RecentActivity'
import CommandBar from '@/components/CommandBar'
import { FolderOpen, ClipboardList, Users, FileText } from 'lucide-react'
import { api } from '@/lib/api'

// ---------------------------------------------------------------------------
// KPI types
// ---------------------------------------------------------------------------

type KpiProject = { project_id: string; project_name: string }
type KpiTask    = { task_id: string; task_name: string; project_id: string; project_name: string; scheduled_end: string }
type KpiClosing = { project_id: string; project_name: string; task_name: string; scheduled_start: string }

type OnTimeProject = {
  project_id: string
  project_name: string
  percentage: number
  completed_count: number
  late_count: number
}

type KpiData = {
  on_time_completion:    { percentage: number; projects: OnTimeProject[] }
  active_projects_today: { count: number; projects: KpiProject[] }
  projects_past_framing: { count: number; projects: KpiProject[] }
  closings_this_week:    { count: number; items: KpiClosing[] }
  tasks_late:            { count: number; items: KpiTask[] }
}

// ---------------------------------------------------------------------------
// Drilldown item — common shape used by the inline selector
// ---------------------------------------------------------------------------

type DrilldownItem = { project_id: string; label: string }

// ---------------------------------------------------------------------------
// Click handler helper — routes on 1, opens selector on many, no-ops on 0
// ---------------------------------------------------------------------------

function handleKpiClick(
  list: { project_id: string; project_name: string }[],
  router: ReturnType<typeof useRouter>,
  showSelector: (items: DrilldownItem[], type: string) => void,
  kpiType: string,
) {
  if (list.length === 1) {
    router.push(`/projects/${list[0].project_id}`)
  } else if (list.length > 1) {
    showSelector(list.map(p => ({ project_id: p.project_id, label: p.project_name })), kpiType)
  }
}

// ---------------------------------------------------------------------------
// Single KPI block
// ---------------------------------------------------------------------------

type KpiBlockProps = {
  label: string
  value: string | number
  clickable: boolean
  onClick: () => void
  accent?: string
}

function KpiBlock({ label, value, clickable, onClick, accent }: KpiBlockProps) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={[
        'flex flex-col items-center justify-center rounded-2xl border px-3 py-4 text-center',
        clickable
          ? 'cursor-pointer border-white/10 bg-white/5 hover:bg-white/[0.09] transition-colors'
          : 'border-white/5 bg-white/[0.03]',
      ].join(' ')}
    >
      <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      <p className="mt-1 text-xs font-medium leading-tight text-slate-400">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter()
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [kpisError, setKpisError] = useState(false)
  const [selectedKpiList, setSelectedKpiList] = useState<DrilldownItem[]>([])
  const [selectedKpiType, setSelectedKpiType] = useState<string | null>(null)

  function showSelector(items: DrilldownItem[], type: string) {
    setSelectedKpiList(items)
    setSelectedKpiType(type)
  }

  function clearSelector() {
    setSelectedKpiList([])
    setSelectedKpiType(null)
  }

  useEffect(() => {
    api.get<KpiData>('/dashboard/kpis')
      .then(setKpis)
      .catch(() => { setKpisError(true) })
  }, [])

  return (
    <>
      <PageHeader title="Ja Lite" subtitle="Command Center" />

      <div className="px-4 py-5 space-y-5">
        <section className="sticky top-16 z-[25] rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/15 via-slate-900/80 to-slate-900 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
              Command Center
            </p>
            <h2 className="text-lg font-semibold text-white">
              Your team, your schedule — in sync.
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Type or speak a command to move tasks, update schedules, or notify your team. Ja handles the rest.
            </p>
          </div>

          <CommandBar />
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/projects"
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm transition-transform hover:scale-[1.02] hover:bg-white/[0.07]"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
              <FolderOpen size={20} />
            </div>
            <p className="text-sm font-semibold text-white">Projects</p>
            <p className="mt-1 text-xs text-slate-400">View and manage builds</p>
          </Link>

          <Link
            href="/logs"
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm transition-transform hover:scale-[1.02] hover:bg-white/[0.07]"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
              <ClipboardList size={20} />
            </div>
            <p className="text-sm font-semibold text-white">Activity Log</p>
            <p className="mt-1 text-xs text-slate-400">See all actions</p>
          </Link>

          <Link
            href="/contacts"
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm transition-transform hover:scale-[1.02] hover:bg-white/[0.07]"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
              <Users size={20} />
            </div>
            <p className="text-sm font-semibold text-white">Contacts</p>
            <p className="mt-1 text-xs text-slate-400">Subs & stakeholders</p>
          </Link>

          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 opacity-70">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
              <FileText size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-300">Schedule Export</p>
            <p className="mt-1 text-xs text-slate-500">PDF export — coming soon</p>
          </div>
        </div>

        {kpisError && !kpis && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Live KPIs
            </p>
            <p className="mt-2 text-xs text-slate-500">KPI data unavailable.</p>
          </section>
        )}

        {kpis && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Live KPIs
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <KpiBlock
                label="On-Time Completion"
                value={`${kpis.on_time_completion.percentage}%`}
                clickable={kpis.on_time_completion.projects.length > 0}
                accent={
                  kpis.on_time_completion.percentage >= 80
                    ? 'text-emerald-400'
                    : kpis.on_time_completion.percentage >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
                }
                onClick={() => {
                  const list = kpis.on_time_completion.projects
                  if (list.length === 1) {
                    router.push(`/projects/${list[0].project_id}`)
                  } else if (list.length > 1) {
                    showSelector(
                      list.map(p => ({ project_id: p.project_id, label: `${p.project_name} — ${p.percentage}% on-time` })),
                      'On-Time Completion',
                    )
                  }
                }}
              />

              <KpiBlock
                label="Active Projects Today"
                value={kpis.active_projects_today.count}
                clickable={kpis.active_projects_today.count > 0}
                onClick={() => handleKpiClick(kpis.active_projects_today.projects, router, showSelector, 'Active Projects Today')}
              />

              <KpiBlock
                label="Past Framing"
                value={kpis.projects_past_framing.count}
                clickable={kpis.projects_past_framing.count > 0}
                onClick={() => handleKpiClick(kpis.projects_past_framing.projects, router, showSelector, 'Past Framing')}
              />

              <KpiBlock
                label="Closings This Week"
                value={kpis.closings_this_week.count}
                clickable={kpis.closings_this_week.count > 0}
                onClick={() => {
                  const items = kpis.closings_this_week.items
                  if (items.length === 1) {
                    router.push(`/projects/${items[0].project_id}`)
                  } else if (items.length > 1) {
                    showSelector(
                      items.map(i => ({ project_id: i.project_id, label: `${i.project_name} — ${i.task_name}` })),
                      'Closings This Week',
                    )
                  }
                }}
              />

              <KpiBlock
                label="Tasks Late"
                value={kpis.tasks_late.count}
                clickable={kpis.tasks_late.count > 0}
                accent={kpis.tasks_late.count > 0 ? 'text-red-400' : 'text-white'}
                onClick={() => {
                  const items = kpis.tasks_late.items
                  if (items.length === 1) {
                    router.push(`/projects/${items[0].project_id}`)
                  } else if (items.length > 1) {
                    showSelector(
                      items.map(i => ({ project_id: i.project_id, label: `${i.task_name} — ${i.project_name}` })),
                      'Tasks Late',
                    )
                  }
                }}
              />
            </div>
          </section>
        )}

        {selectedKpiType && selectedKpiList.length > 1 && (
          <section className="rounded-2xl border border-orange-500/20 bg-white/5 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Select Project</p>
              <button
                onClick={clearSelector}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/70">
              {selectedKpiType === 'Tasks Late' ? 'Projects Requiring Attention' : selectedKpiType}
            </p>
            <ul className="space-y-1">
              {selectedKpiList.map((item, i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      clearSelector()
                      router.push(`/projects/${item.project_id}`)
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/[0.09] hover:text-white transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Recent Activity
            </p>
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.7)]" />
          </div>
          <RecentActivity />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            System Status
          </p>
          <p className="text-sm text-slate-200">
            Ja Lite is live. Commands are being processed, executed, and logged in real time.
          </p>
        </section>
      </div>
    </>
  )
}
