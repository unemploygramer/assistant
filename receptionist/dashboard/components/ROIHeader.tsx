'use client'

import { useState, useEffect } from 'react'
import { Users, Calendar, DollarSign } from 'lucide-react'

export function ROIHeader() {
  const [stats, setStats] = useState<{ totalLeads: number; appointmentsSet: number; pipelineValue: number } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard-stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.totalLeads !== undefined) setStats({ totalLeads: d.totalLeads, appointmentsSet: d.appointmentsSet ?? 0, pipelineValue: d.pipelineValue ?? 0 })
      })
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="glass rounded-lg p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/20 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Leads</p>
          <p className="text-2xl font-bold text-foreground">{stats.totalLeads}</p>
        </div>
      </div>
      <div className="glass rounded-lg p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary/20 text-secondary">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Appointments Set</p>
          <p className="text-2xl font-bold text-foreground">{stats.appointmentsSet}</p>
        </div>
      </div>
      <div className="glass rounded-lg p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary/20 text-secondary">
          <DollarSign className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline Value</p>
          <p className="text-2xl font-bold text-secondary glow-pipeline">${stats.pipelineValue.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
