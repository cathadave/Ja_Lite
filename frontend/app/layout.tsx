import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'Ja Lite',
  description: 'Scheduling assistant for Jeff',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white antialiased">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(234,88,12,0.18),_transparent_28%),linear-gradient(180deg,_#0f172a_0%,_#111827_45%,_#020617_100%)]">
          <div className="max-w-md mx-auto relative min-h-screen pb-36 border-x border-white/5 bg-white/[0.02] backdrop-blur-sm">
            {children}
          </div>
        </div>
        <BottomNav />
      </body>
    </html>
  )
}