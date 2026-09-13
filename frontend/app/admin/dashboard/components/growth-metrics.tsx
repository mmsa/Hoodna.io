'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AdminGrowthMetrics, GrowthBreakdownRow } from '@hoodna/shared'
import { RefreshCw } from 'lucide-react'

import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableShell,
} from '@/components/ui/data-table'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'

function mondayUtc(d = new Date()) {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = copy.getUTCDay() || 7
  copy.setUTCDate(copy.getUTCDate() - day + 1)
  return copy.toISOString().slice(0, 10)
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function BreakdownTable({ title, rows }: { title: string; rows: GrowthBreakdownRow[] }) {
  if (!rows.length) {
    return <EmptyState className="min-h-24" title={`No ${title.toLowerCase()} yet`} />
  }
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <DataTableShell>
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Key</DataTableHead>
              <DataTableHead>Registrations</DataTableHead>
              <DataTableHead>Verified</DataTableHead>
              <DataTableHead>Activated</DataTableHead>
              <DataTableHead>WAVR</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {rows.map((row) => (
              <DataTableRow key={row.key}>
                <DataTableCell className="font-medium">{row.key}</DataTableCell>
                <DataTableCell>{row.registrations}</DataTableCell>
                <DataTableCell>{row.verified}</DataTableCell>
                <DataTableCell>{row.activated}</DataTableCell>
                <DataTableCell>{row.wavr}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableShell>
    </div>
  )
}

export default function GrowthMetrics() {
  const [weekStart, setWeekStart] = useState(mondayUtc())
  const query = useQuery<AdminGrowthMetrics>({
    queryKey: ['admin-growth-metrics', weekStart],
    queryFn: async () => (await api.get('/api/admin/growth-metrics', { params: { week_start: weekStart } })).data,
  })
  const cards = useMemo(() => {
    const data = query.data
    if (!data) return []
    return [
      ['Registrations', data.total_registrations],
      ['Verified residents', data.verified_residents],
      ['Activated verified', data.activated_verified_residents],
      ['Activation rate', pct(data.activation_rate)],
      ['WAVR', data.wavr],
      ['WAU', data.wau],
      ['MAU', data.mau],
      ['Active compounds', data.active_compounds],
      ['Referral registrations', data.referral_registrations],
      ['Referral share', pct(data.referral_share)],
      ['D7 return', `${data.d7_returned}/${data.d7_eligible} (${pct(data.d7_return_rate)})`],
      ['D30 return', `${data.d30_returned}/${data.d30_eligible} (${pct(data.d30_return_rate)})`],
    ] as [string, string | number][]
  }, [query.data])

  return (
    <section className="space-y-6" aria-labelledby="growth-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="growth-heading" className="text-xl font-semibold">Growth</h2>
          <p className="text-sm text-muted-foreground">
            Where verified active residents came from. UTC week Monday–Sunday. Demo and seed-admin accounts are excluded.
          </p>
        </div>
        <div className="flex gap-2">
          <div>
            <Label htmlFor="growth-week">Week start (UTC Monday)</Label>
            <Input id="growth-week" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          </div>
          <Button className="self-end" variant="outline" onClick={() => query.refetch()}>
            <RefreshCw aria-hidden="true" className="mr-1 h-4 w-4" />Refresh
          </Button>
        </div>
      </div>
      {query.isLoading ? <LoadingState title="Loading growth metrics" /> :
        query.isError ? <ErrorState title="Could not load growth metrics" description="Try again as an admin." action={<Button onClick={() => query.refetch()}>Retry</Button>} /> :
        query.data && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map(([label, value]) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Week {query.data.week_start} → {query.data.week_end}. WAVR counts verified residents with a post, comment,
              listing, message, or authenticated app open in the UTC week.
            </p>
            <BreakdownTable title="By source" rows={query.data.by_source} />
            <BreakdownTable title="By campaign" rows={query.data.by_campaign} />
            <BreakdownTable title="By registration platform" rows={query.data.by_platform} />
            <BreakdownTable title="By compound" rows={query.data.by_compound} />
          </div>
        )}
    </section>
  )
}
