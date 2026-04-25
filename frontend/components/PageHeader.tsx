'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
}

export default function PageHeader({ title, subtitle, showBack = false }: PageHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/85 backdrop-blur-md">
      <div className="px-4 py-3 flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-400/80">
            Catha Command
          </p>
          <h1 className="text-lg font-bold leading-tight text-white">{title}</h1>
          {subtitle && (
            <p className="text-xs leading-tight text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  )
}