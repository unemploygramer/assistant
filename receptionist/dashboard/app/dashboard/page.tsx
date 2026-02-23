'use client'

import { ROIHeader } from '@/components/ROIHeader'
import { PaperCalendar } from '@/components/PaperCalendar'
import { LeadFeed } from '@/components/LeadFeed'

export default function DashboardPage() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6">
      <div className="flex-1 min-w-0">
        <ROIHeader />
        <PaperCalendar />
      </div>
      <aside className="w-full lg:w-80 shrink-0">
        <LeadFeed />
      </aside>
    </div>
  )
}
