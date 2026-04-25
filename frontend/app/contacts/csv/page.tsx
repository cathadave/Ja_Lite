import PageHeader from '@/components/PageHeader'
import ContactCsvImporter from '@/components/onboarding/ContactCsvImporter'

export default function ContactCsvPage() {
  return (
    <>
      <PageHeader title="Import Contacts" subtitle="Upload a CSV to bulk-add contacts" />
      <ContactCsvImporter />
    </>
  )
}
