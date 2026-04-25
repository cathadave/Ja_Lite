'use client'

import PageHeader from '@/components/PageHeader'
import CsvImporter from '@/components/onboarding/CsvImporter'

export default function CsvOnboardingPage() {
  return (
    <>
      <PageHeader title="Import Projects" subtitle="Onboard from CSV" showBack />
      <CsvImporter />
    </>
  )
}
