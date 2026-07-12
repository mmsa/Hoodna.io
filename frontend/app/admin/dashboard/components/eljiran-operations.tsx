'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminAuditEntry,
  AdminAuditList,
  AdminBetaMetrics,
  BetaMetricPoint,
  BusinessClaim,
  FeatureFlag,
  FeatureFlagOverride,
  FeatureFlagScope,
  ReportResponse,
  ReportStatus,
} from '@hoodna/shared'
import { toast } from 'sonner'
import { Check, Flag, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react'

import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableShell,
} from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type ClaimList = { items: BusinessClaim[]; total: number; skip: number; limit: number }
type Decision = { kind: 'claim' | 'report'; id: number; action: string; title: string }

const message = (error: unknown) =>
  (error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
  (error as Error)?.message ||
  'The operation could not be completed.'

function DecisionDialog({
  decision,
  busy,
  onClose,
  onSubmit,
}: {
  decision: Decision | null
  busy: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const requiresReason = decision?.action !== 'APPROVED'

  return (
    <Dialog open={decision != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{decision?.title}</DialogTitle>
          <DialogDescription>
            Confirm this operational action. The note is retained for support and audit context.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="decision-reason">
            {requiresReason ? 'Reason *' : 'Internal note (optional)'}
          </Label>
          <Textarea
            id="decision-reason"
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Add concise decision context"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={decision?.action === 'REJECTED' || decision?.action === 'DISMISSED' ? 'destructive' : 'default'}
            disabled={busy || (requiresReason && !reason.trim())}
            onClick={() => onSubmit(reason.trim())}
          >
            {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ClaimsQueue() {
  const client = useQueryClient()
  const [status, setStatus] = useState('PENDING')
  const [decision, setDecision] = useState<Decision | null>(null)
  const query = useQuery<ClaimList>({
    queryKey: ['admin-business-claims', status],
    queryFn: async () => (await api.get(`/api/admin/businesses/claims?status=${status}`)).data,
  })
  const review = useMutation({
    mutationFn: async ({ action, id, reason }: { action: string; id: number; reason: string }) =>
      api.post(`/api/admin/businesses/claims/${id}/${action === 'APPROVED' ? 'approve' : 'reject'}`, {
        review_notes: reason || null,
        membership_role: 'OWNER',
      }),
    onSuccess: async () => {
      setDecision(null)
      await client.invalidateQueries({ queryKey: ['admin-business-claims'] })
      toast.success('Business claim updated')
    },
    onError: (error) => toast.error(message(error)),
  })
  const claimItems: BusinessClaim[] = query.data?.items ?? []

  return (
    <section className="space-y-4" aria-labelledby="claims-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="claims-heading" className="text-xl font-semibold">Business claim review</h2>
          <p className="text-sm text-muted-foreground">Verify claimant details before granting ownership.</p>
        </div>
        <div className="w-44">
          <Label htmlFor="claim-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="claim-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['PENDING', 'APPROVED', 'REJECTED'].map((value) => (
                <SelectItem key={value} value={value}>{value.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {query.isLoading ? <LoadingState title="Loading business claims" /> :
        query.isError ? <ErrorState title="Could not load business claims" description={message(query.error)} action={<Button onClick={() => query.refetch()}>Retry</Button>} /> :
        !claimItems.length ? <EmptyState title="No claims in this queue" description={`There are no ${status.toLowerCase()} business claims.`} /> :
        <DataTableShell>
          <DataTable>
            <DataTableHeader><DataTableRow>
              <DataTableHead>Business</DataTableHead><DataTableHead>Claimant</DataTableHead>
              <DataTableHead>Relationship</DataTableHead><DataTableHead>Submitted</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </DataTableRow></DataTableHeader>
            <DataTableBody>
              {claimItems.map((claim) => (
                <DataTableRow key={claim.id}>
                  <DataTableCell className="font-medium">{claim.business_name || `Business #${claim.business_id}`}</DataTableCell>
                  <DataTableCell>
                    <div>{claim.full_name}</div>
                    <div className="text-xs text-muted-foreground">{claim.email} · {claim.phone}</div>
                  </DataTableCell>
                  <DataTableCell>{claim.relationship_role}</DataTableCell>
                  <DataTableCell>{new Date(claim.submitted_at).toLocaleString()}</DataTableCell>
                  <DataTableCell>
                    {claim.status === 'PENDING' ? <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => setDecision({ kind: 'claim', id: claim.id, action: 'APPROVED', title: `Approve ${claim.business_name || 'claim'}?` })}>
                        <Check aria-hidden="true" className="mr-1 h-4 w-4" />Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDecision({ kind: 'claim', id: claim.id, action: 'REJECTED', title: `Reject ${claim.business_name || 'claim'}?` })}>
                        <X aria-hidden="true" className="mr-1 h-4 w-4" />Reject
                      </Button>
                    </div> : <div className="text-right text-sm text-muted-foreground">{claim.review_notes || 'No review note'}</div>}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableShell>}
      <DecisionDialog
        decision={decision}
        busy={review.isPending}
        onClose={() => setDecision(null)}
        onSubmit={(reason) => decision && review.mutate({ action: decision.action, id: decision.id, reason })}
      />
    </section>
  )
}

function ModerationQueue() {
  const client = useQueryClient()
  const [status, setStatus] = useState<ReportStatus>('OPEN')
  const [decision, setDecision] = useState<Decision | null>(null)
  const query = useQuery<ReportResponse[]>({
    queryKey: ['admin-reports', status],
    queryFn: async () => (await api.get('/api/reports', { params: { status_filter: status, limit: 100 } })).data,
  })
  const update = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: string; reason: string }) =>
      api.patch(`/api/reports/${id}`, { status: action, review_notes: reason }),
    onSuccess: async () => {
      setDecision(null)
      await client.invalidateQueries({ queryKey: ['admin-reports'] })
      toast.success('Moderation report updated')
    },
    onError: (error) => toast.error(message(error)),
  })
  const reportItems: ReportResponse[] = query.data ?? []

  return (
    <section className="space-y-4" aria-labelledby="moderation-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="moderation-heading" className="text-xl font-semibold">Moderation queue</h2>
          <p className="text-sm text-muted-foreground">Triage reports and retain internal review notes.</p></div>
        <div className="w-48"><Label htmlFor="report-status">Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as ReportStatus)}>
            <SelectTrigger id="report-status"><SelectValue /></SelectTrigger>
            <SelectContent>{['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].map((value) => <SelectItem key={value} value={value}>{value.replace('_', ' ')}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {query.isLoading ? <LoadingState title="Loading moderation reports" /> :
        query.isError ? <ErrorState title="Could not load moderation reports" description={message(query.error)} action={<Button onClick={() => query.refetch()}>Retry</Button>} /> :
        !reportItems.length ? <EmptyState title="Queue is clear" description={`No reports are ${status.toLowerCase().replace('_', ' ')}.`} /> :
        <div className="space-y-3">
          {reportItems.map((report) => <Card key={report.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><CardTitle className="text-base">{report.reported_type} #{report.reported_id}</CardTitle>
                  <CardDescription>Reported by {report.reporter_name || `user #${report.reporter_id}`} · {new Date(report.created_at).toLocaleString()}</CardDescription></div>
                <Badge variant="outline">{report.status.replace('_', ' ')}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div><span className="font-medium">{report.reason.replaceAll('_', ' ')}</span>{report.description && <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>}</div>
              {report.review_notes && <div className="rounded-md bg-muted p-3 text-sm"><span className="font-medium">Internal notes: </span>{report.review_notes}</div>}
              <div className="flex flex-wrap gap-2">
                {report.status === 'OPEN' && <Button size="sm" variant="outline" onClick={() => setDecision({ kind: 'report', id: report.id, action: 'UNDER_REVIEW', title: 'Start review?' })}>Start review</Button>}
                {!['RESOLVED', 'DISMISSED'].includes(report.status) && <>
                  <Button size="sm" onClick={() => setDecision({ kind: 'report', id: report.id, action: 'RESOLVED', title: 'Resolve report?' })}>Resolve</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDecision({ kind: 'report', id: report.id, action: 'DISMISSED', title: 'Dismiss report?' })}>Dismiss</Button>
                </>}
              </div>
            </CardContent>
          </Card>)}
        </div>}
      <DecisionDialog decision={decision} busy={update.isPending} onClose={() => setDecision(null)}
        onSubmit={(reason) => decision && update.mutate({ id: decision.id, action: decision.action, reason })} />
    </section>
  )
}

const flagLabels: Record<string, string> = {
  invitations: 'Invitations', business_claiming: 'Business claiming', weekly_digest: 'Weekly digest',
  community_posting: 'Community posting', business_reviews: 'Business reviews', user_registration: 'User registration',
}

function FeatureControls() {
  const client = useQueryClient()
  const [selectedKey, setSelectedKey] = useState('')
  const [scope, setScope] = useState<Exclude<FeatureFlagScope, 'GLOBAL' | 'NEIGHBOURHOOD'>>('USER')
  const [target, setTarget] = useState('')
  const [overrideEnabled, setOverrideEnabled] = useState(true)
  const flags = useQuery<FeatureFlag[]>({ queryKey: ['admin-feature-flags'], queryFn: async () => (await api.get('/api/admin/feature-flags')).data })
  const overrides = useQuery<FeatureFlagOverride[]>({
    queryKey: ['admin-feature-overrides', selectedKey],
    enabled: Boolean(selectedKey),
    queryFn: async () => (await api.get(`/api/admin/feature-flags/${selectedKey}/overrides`)).data,
  })
  const toggle = useMutation({
    mutationFn: (flag: FeatureFlag) => api.put(`/api/admin/feature-flags/${flag.key}`, { enabled: !flag.enabled, description: flag.description || null, config: flag.config || {} }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin-feature-flags'] }); toast.success('Feature default updated') },
    onError: (error) => toast.error(message(error)),
  })
  const createOverride = useMutation({
    mutationFn: () => api.post(`/api/admin/feature-flags/${selectedKey}/overrides`, {
      scope, enabled: overrideEnabled,
      user_id: scope === 'USER' ? Number(target) : null,
      compound_id: scope === 'COMPOUND' ? Number(target) : null,
      city: scope === 'CITY' ? target.trim() : null,
      config: {},
    }),
    onSuccess: async () => { setTarget(''); await client.invalidateQueries({ queryKey: ['admin-feature-overrides', selectedKey] }); toast.success('Pilot override added') },
    onError: (error) => toast.error(message(error)),
  })
  const removeOverride = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/feature-flags/${selectedKey}/overrides/${id}`),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin-feature-overrides', selectedKey] }); toast.success('Override removed') },
    onError: (error) => toast.error(message(error)),
  })
  const flagItems: FeatureFlag[] = flags.data ?? []
  const overrideItems: FeatureFlagOverride[] = overrides.data ?? []

  return <section className="space-y-5" aria-labelledby="features-heading">
    <div><h2 id="features-heading" className="text-xl font-semibold">Feature rollout</h2>
      <p className="text-sm text-muted-foreground">Global defaults stay off until enabled; scoped overrides support user, compound, and city pilots.</p></div>
    {flags.isLoading ? <LoadingState title="Loading feature controls" /> :
      flags.isError ? <ErrorState title="Could not load feature controls" description={message(flags.error)} action={<Button onClick={() => flags.refetch()}>Retry</Button>} /> :
      !flagItems.length ? <EmptyState title="No database flags seeded" description="Seed disabled defaults before configuring pilot overrides." /> :
      <div className="grid gap-3 md:grid-cols-2">
        {flagItems.map((flag) => <Card key={flag.key}>
          <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3">
            <div><CardTitle className="text-base">{flagLabels[flag.key] || flag.key}</CardTitle><CardDescription>{flag.description || 'No description'}</CardDescription></div>
            <Badge variant={flag.enabled ? 'default' : 'outline'}>{flag.enabled ? 'Enabled' : 'Disabled'}</Badge>
          </div></CardHeader>
          <CardContent className="flex gap-2">
            <Button size="sm" variant={flag.enabled ? 'destructive' : 'default'} disabled={toggle.isPending}
              onClick={() => window.confirm(`${flag.enabled ? 'Disable' : 'Enable'} ${flagLabels[flag.key] || flag.key} globally?`) && toggle.mutate(flag)}>
              {flag.enabled ? 'Disable globally' : 'Enable globally'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedKey(flag.key)}>Overrides</Button>
          </CardContent>
        </Card>)}
      </div>}
    {selectedKey && <Card>
      <CardHeader><CardTitle className="text-base">{flagLabels[selectedKey] || selectedKey} overrides</CardTitle>
        <CardDescription>More specific overrides take precedence over the global default.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[160px_1fr_150px_auto]">
          <div><Label htmlFor="override-scope">Scope</Label><Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
            <SelectTrigger id="override-scope"><SelectValue /></SelectTrigger><SelectContent>{['USER', 'COMPOUND', 'CITY'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select></div>
          <div><Label htmlFor="override-target">{scope === 'CITY' ? 'City' : `${scope.toLowerCase()} ID`}</Label><Input id="override-target" value={target} onChange={(event) => setTarget(event.target.value)} inputMode={scope === 'CITY' ? 'text' : 'numeric'} /></div>
          <div><Label htmlFor="override-value">Value</Label><Select value={String(overrideEnabled)} onValueChange={(value) => setOverrideEnabled(value === 'true')}>
            <SelectTrigger id="override-value"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Enabled</SelectItem><SelectItem value="false">Disabled</SelectItem></SelectContent>
          </Select></div>
          <Button className="self-end" disabled={!target.trim() || createOverride.isPending} onClick={() => createOverride.mutate()}><Plus aria-hidden="true" className="mr-1 h-4 w-4" />Add</Button>
        </div>
        {overrides.isLoading ? <LoadingState className="min-h-32" title="Loading overrides" /> :
          overrides.isError ? <ErrorState className="min-h-32" title="Could not load overrides" description={message(overrides.error)} /> :
          !overrideItems.length ? <EmptyState className="min-h-32" title="No scoped overrides" /> :
          <div className="space-y-2">{overrideItems.map((item) => <div key={item.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div><span className="font-medium">{item.scope}</span> · {item.target_key || item.city || item.user_id || item.compound_id} · <span className={item.enabled ? 'text-green-700' : 'text-red-700'}>{item.enabled ? 'enabled' : 'disabled'}</span></div>
            <Button size="icon" variant="ghost" aria-label={`Remove ${item.scope} override`} onClick={() => item.id && removeOverride.mutate(item.id)}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
          </div>)}</div>}
      </CardContent>
    </Card>}
  </section>
}

function BetaMetrics() {
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)
  const query = useQuery<AdminBetaMetrics>({
    queryKey: ['admin-beta-metrics', from, to],
    queryFn: async () => (await api.get('/api/admin/beta-metrics', { params: { date_from: from, date_to: to } })).data,
    enabled: Boolean(from && to && from <= to),
  })
  const totals = useMemo<[string, number][]>(() => query.data ? [
    ['Registered users', query.data.total_registered_users], ['Active users', query.data.active_users],
    ['Posts', query.data.posts_created], ['Comments', query.data.comments_created],
    ['Searches', query.data.searches_performed], ['Business claims', query.data.business_claims],
    ['Reports awaiting review', query.data.reports_awaiting_review], ['Invitations sent', query.data.invitations_sent],
    ['Successful referrals', query.data.successful_referrals], ['Client errors', query.data.client_errors],
  ] : [], [query.data])
  const trendPoints: BetaMetricPoint[] = query.data?.new_users_by_day ?? []
  const maxTrend = Math.max(1, ...trendPoints.map((point) => point.value))

  return <section className="space-y-5" aria-labelledby="metrics-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="metrics-heading" className="text-xl font-semibold">Beta metrics</h2>
      <p className="text-sm text-muted-foreground">Totals, rates, and daily trends are shown separately.</p></div>
      <div className="flex gap-2"><div><Label htmlFor="metrics-from">From</Label><Input id="metrics-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label htmlFor="metrics-to">To</Label><Input id="metrics-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></div></div></div>
    {from > to ? <ErrorState title="Invalid date range" description="The start date must be on or before the end date." /> :
      query.isLoading ? <LoadingState title="Loading beta metrics" /> :
      query.isError ? <ErrorState title="Could not load beta metrics" description={message(query.error)} action={<Button onClick={() => query.refetch()}>Retry</Button>} /> :
      query.data && <div className="space-y-5">
        <div><h3 className="mb-2 font-semibold">Totals</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{totals.map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>)}</div></div>
        <div><h3 className="mb-2 font-semibold">Rates</h3><Card><CardContent className="p-4"><div className="text-2xl font-bold">{(query.data.onboarding_completion_rate * 100).toFixed(1)}%</div><div className="text-sm text-muted-foreground">Onboarding completion rate</div></CardContent></Card></div>
        <div><h3 className="mb-2 font-semibold">New-user trend</h3><Card><CardContent className="space-y-2 p-4">{trendPoints.length ? trendPoints.map((point) => <div key={point.date} className="grid grid-cols-[90px_1fr_40px] items-center gap-2 text-xs"><span>{point.date}</span><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.max(2, point.value / maxTrend * 100)}%` }} /></div><span className="text-right">{point.value}</span></div>) : <p className="text-sm text-muted-foreground">No new-user activity in this range.</p>}</CardContent></Card></div>
      </div>}
  </section>
}

function AuditLog() {
  const [eventType, setEventType] = useState('')
  const [actorId, setActorId] = useState('')
  const query = useQuery<AdminAuditList>({
    queryKey: ['admin-audit-log', eventType, actorId],
    queryFn: async () => (await api.get('/api/admin/audit-logs', { params: { event_type: eventType || undefined, actor_id: actorId || undefined, limit: 100 } })).data,
  })
  const auditItems: AdminAuditEntry[] = query.data?.items ?? []

  return <section className="space-y-4" aria-labelledby="audit-heading">
    <div><h2 id="audit-heading" className="text-xl font-semibold">Audit log</h2><p className="text-sm text-muted-foreground">Immutable administrative and moderation events.</p></div>
    <div className="flex flex-wrap gap-3"><div><Label htmlFor="audit-event">Event type</Label><Input id="audit-event" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="e.g. report.resolved" /></div>
      <div><Label htmlFor="audit-actor">Actor ID</Label><Input id="audit-actor" inputMode="numeric" value={actorId} onChange={(e) => setActorId(e.target.value.replace(/\D/g, ''))} /></div>
      <Button className="self-end" variant="outline" onClick={() => query.refetch()}><RefreshCw aria-hidden="true" className="mr-1 h-4 w-4" />Refresh</Button></div>
    {query.isLoading ? <LoadingState title="Loading audit events" /> :
      query.isError ? <ErrorState title="Could not load audit log" description={message(query.error)} action={<Button onClick={() => query.refetch()}>Retry</Button>} /> :
      !auditItems.length ? <EmptyState title="No audit events found" /> :
      <DataTableShell><DataTable><DataTableHeader><DataTableRow><DataTableHead>Time</DataTableHead><DataTableHead>Event</DataTableHead><DataTableHead>Actor</DataTableHead><DataTableHead>Entity</DataTableHead><DataTableHead>Context</DataTableHead></DataTableRow></DataTableHeader>
        <DataTableBody>{auditItems.map((entry) => <DataTableRow key={entry.id}><DataTableCell>{new Date(entry.created_at).toLocaleString()}</DataTableCell><DataTableCell className="font-medium">{entry.event_type || entry.action}</DataTableCell><DataTableCell>{entry.actor_id || 'System'}</DataTableCell><DataTableCell>{entry.entity_type || entry.target_type || '—'} {entry.entity_id || entry.target_id || ''}</DataTableCell><DataTableCell className="max-w-sm truncate">{JSON.stringify(entry.data || entry.metadata || {})}</DataTableCell></DataTableRow>)}</DataTableBody>
      </DataTable></DataTableShell>}
  </section>
}

export default function EljiranOperations() {
  return <Tabs defaultValue="claims" className="space-y-5">
    <TabsList className="flex h-auto flex-wrap justify-start">
      <TabsTrigger value="claims">Business claims</TabsTrigger>
      <TabsTrigger value="moderation">Moderation</TabsTrigger>
      <TabsTrigger value="features"><Flag aria-hidden="true" className="mr-1 h-4 w-4" />Features</TabsTrigger>
      <TabsTrigger value="metrics">Beta metrics</TabsTrigger>
      <TabsTrigger value="audit">Audit log</TabsTrigger>
    </TabsList>
    <TabsContent value="claims"><ClaimsQueue /></TabsContent>
    <TabsContent value="moderation"><ModerationQueue /></TabsContent>
    <TabsContent value="features"><FeatureControls /></TabsContent>
    <TabsContent value="metrics"><BetaMetrics /></TabsContent>
    <TabsContent value="audit"><AuditLog /></TabsContent>
  </Tabs>
}
