'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FolderOpen, ChevronRight, Upload, Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { api } from '@/lib/api'
import type { ProjectRecord, TaskRecord } from '@/lib/types'

const statusStyles: Record<string, string> = {
  planning: 'border border-blue-400/20 bg-blue-500/10 text-blue-300',
  active: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
  on_hold: 'border border-amber-400/20 bg-amber-500/10 text-amber-300',
  completed: 'border border-slate-400/20 bg-slate-500/10 text-slate-300',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function loadProjects() {
      try {
        setError('')

        let projectData: ProjectRecord[]
        try {
          projectData = await api.get<ProjectRecord[]>('/projects/')
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          projectData = await api.get<ProjectRecord[]>('/projects/')
        }
        setProjects(projectData)

        const counts: Record<string, number> = {}

        await Promise.all(
          projectData.map(async (project) => {
            try {
              const tasks = await api.get<TaskRecord[]>(`/tasks/?project_id=${project.id}`)
              counts[project.id] = tasks.length
            } catch {
              counts[project.id] = 0
            }
          })
        )

        setTaskCounts(counts)
      } catch (err) {
        console.error(err)
        setError('Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  return (
    <>
      <PageHeader title="Projects" subtitle="Active jobs" />

      <div className="px-4 py-5 space-y-4">
        <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/12 via-slate-900/80 to-slate-900 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">
                Build Control
              </p>
              <h2 className="text-lg font-semibold text-white">Project Command Board</h2>
              <p className="mt-1 text-sm text-slate-300">
                Monitor active jobs, open task loads, and navigate directly into live project detail.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => router.push('/onboarding')}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-500/15 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/25 transition-colors"
            >
              <Plus size={18} />
              New Project
            </button>
            <button
              onClick={() => router.push('/onboarding/csv')}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-500/15 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/25 transition-colors"
            >
              <Upload size={18} />
              Import CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 shadow-sm">
            <p className="text-sm text-slate-400">Loading projects...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Project List
              </p>
              <p className="text-xs text-slate-500">{projects.length} total</p>
            </div>

            {projects.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 shadow-sm">
                <p className="text-sm text-slate-400">No projects found.</p>
              </div>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm transition-all active:scale-95 hover:bg-white/[0.07]"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500/12 text-orange-400">
                    <FolderOpen size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {project.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {taskCounts[project.id] ?? 0} tasks
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${
                        statusStyles[project.status] || 'border border-slate-400/20 bg-slate-500/10 text-slate-300'
                      }`}
                    >
                      {project.status}
                    </span>
                    <ChevronRight size={15} className="text-slate-500" />
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}