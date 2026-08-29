'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, MessageSquareText, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { formatCompoundWithArea } from '@/lib/format-compound'
import { cn } from '@/lib/utils'

type Source = 'WHATSAPP' | 'TELEGRAM'
type ItemKind = 'USER' | 'POST' | 'COMMENT' | 'LISTING' | 'SKIP'
type Decision = 'PENDING' | 'APPROVED' | 'REJECTED'

interface CompoundRow {
  id: number
  name: string
  area?: string | null
}

interface ImportItem {
  id: number
  kind: ItemKind
  decision: Decision
  normalized: Record<string, unknown>
  reject_reason?: string | null
  published_entity_type?: string | null
  published_entity_id?: number | null
}

interface ImportJob {
  id: number
  compound_id: number
  source: Source
  status: string
  original_filename?: string | null
  stats?: Record<string, unknown>
  error_message?: string | null
  items?: ImportItem[]
  item_count?: number
  created_at: string
}

interface ItemsPage {
  items: ImportItem[]
  total: number
  skip: number
  limit: number
}

interface JobListItem {
  id: number
  compound_id: number
  source: Source
  status: string
  original_filename?: string | null
  stats?: Record<string, unknown>
  created_at: string
}

const PAGE_SIZE = 50

export default function ChatImportPanel() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [compoundId, setCompoundId] = useState<string>('')
  const [source, setSource] = useState<Source>('WHATSAPP')
  const [file, setFile] = useState<File | null>(null)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const [kindFilter, setKindFilter] = useState<'ALL' | ItemKind>('ALL')
  const [itemPage, setItemPage] = useState(0)

  const { data: compoundsData } = useQuery({
    queryKey: ['admin-compounds-chat-import'],
    queryFn: async () => {
      const response = await api.get('/api/admin/compounds?limit=200&skip=0')
      return response.data as { items: CompoundRow[]; total: number }
    },
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['admin-chat-imports', compoundId],
    queryFn: async () => {
      const params = compoundId ? `?compound_id=${compoundId}` : ''
      const response = await api.get(`/api/admin/chat-imports${params}`)
      return response.data as JobListItem[]
    },
  })

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['admin-chat-import', activeJobId],
    queryFn: async () => {
      const response = await api.get(`/api/admin/chat-imports/${activeJobId}`)
      return response.data as ImportJob
    },
    enabled: !!activeJobId,
    refetchInterval: (query) =>
      query.state.data?.status === 'PARSING' || query.state.data?.status === 'PUBLISHING'
        ? 2000
        : false,
  })

  const kindParam = kindFilter === 'ALL' ? '' : `&kind=${kindFilter}`
  const { data: itemsPage, isLoading: itemsLoading } = useQuery({
    queryKey: ['admin-chat-import-items', activeJobId, kindFilter, itemPage],
    queryFn: async () => {
      const response = await api.get(
        `/api/admin/chat-imports/${activeJobId}/items?skip=${itemPage * PAGE_SIZE}&limit=${PAGE_SIZE}${kindParam}`,
      )
      return response.data as ItemsPage
    },
    enabled: !!activeJobId && !!job && job.status !== 'PARSING' && job.status !== 'UPLOADED',
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!compoundId || !file) throw new Error('Pick a compound and file')
      const form = new FormData()
      form.append('compound_id', compoundId)
      form.append('source', source)
      form.append('file', file)
      const response = await api.post('/api/admin/chat-imports', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data as ImportJob
    },
    onSuccess: (created) => {
      setActiveJobId(created.id)
      setItemPage(0)
      setFile(null)
      queryClient.invalidateQueries({ queryKey: ['admin-chat-imports'] })
      toast({ title: 'Upload saved', description: `Job #${created.id} ready to parse.` })
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error?.response?.data?.detail || error.message,
        variant: 'destructive',
      })
    },
  })

  const parseMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await api.post(`/api/admin/chat-imports/${jobId}/parse`, null, {
        // Large Telegram/WhatsApp exports + optional LLM can take a while
        timeout: 600_000,
      })
      return response.data as ImportJob
    },
    onSuccess: () => {
      setItemPage(0)
      queryClient.invalidateQueries({ queryKey: ['admin-chat-import', activeJobId] })
      queryClient.invalidateQueries({ queryKey: ['admin-chat-import-items'] })
      queryClient.invalidateQueries({ queryKey: ['admin-chat-imports'] })
      toast({ title: 'Parsed', description: 'Review items before publishing.' })
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-chat-import', activeJobId] })
      queryClient.invalidateQueries({ queryKey: ['admin-chat-imports'] })
      toast({
        title: 'Parse failed',
        description: error?.response?.data?.detail || error.message,
        variant: 'destructive',
      })
    },
  })

  const patchMutation = useMutation({
    mutationFn: async (items: Array<{ id: number; decision: Decision; kind?: ItemKind }>) => {
      if (!activeJobId) throw new Error('No job')
      const response = await api.patch(`/api/admin/chat-imports/${activeJobId}/items`, { items })
      return response.data as ImportJob
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chat-import-items', activeJobId] })
      queryClient.invalidateQueries({ queryKey: ['admin-chat-import', activeJobId] })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await api.post(`/api/admin/chat-imports/${jobId}/publish`, null, {
        timeout: 600_000,
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-chat-import', activeJobId] })
      queryClient.invalidateQueries({ queryKey: ['admin-chat-import-items'] })
      queryClient.invalidateQueries({ queryKey: ['admin-chat-imports'] })
      toast({
        title: 'Published',
        description: JSON.stringify(data.stats?.publish || data.stats || {}),
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Publish failed',
        description: error?.response?.data?.detail || error.message,
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (jobId: number) => {
      await api.delete(`/api/admin/chat-imports/${jobId}`)
    },
    onSuccess: () => {
      setActiveJobId(null)
      queryClient.invalidateQueries({ queryKey: ['admin-chat-imports'] })
      toast({ title: 'Import discarded' })
    },
  })

  const compounds = compoundsData?.items || []

  const maskPhone = (phone: unknown) => {
    const raw = String(phone || '')
    if (!raw) return 'no phone'
    if (raw.length <= 4) return '••••'
    return `••••${raw.slice(-4)}`
  }

  const visibleItems = useMemo(() => {
    const items = itemsPage?.items || []
    // Parent post first, then its comments; other kinds keep relative order
    const users = items.filter((i) => i.kind === 'USER')
    const roots = items.filter((i) => i.kind === 'POST' || i.kind === 'LISTING')
    const comments = items.filter((i) => i.kind === 'COMMENT')
    const skips = items.filter((i) => i.kind === 'SKIP')
    const other = items.filter(
      (i) => !['USER', 'POST', 'LISTING', 'COMMENT', 'SKIP'].includes(i.kind),
    )

    const ordered: ImportItem[] = [...users]
    for (const root of roots) {
      ordered.push(root)
      const parentIdx = root.normalized?.message_index
      if (root.kind === 'POST' && parentIdx !== undefined) {
        const children = comments.filter(
          (c) => c.normalized?.parent_message_index === parentIdx,
        )
        ordered.push(...children)
      }
    }
    const attached = new Set(
      ordered.filter((i) => i.kind === 'COMMENT').map((i) => i.id),
    )
    for (const comment of comments) {
      if (!attached.has(comment.id)) ordered.push(comment)
    }
    ordered.push(...skips, ...other)
    return ordered
  }, [itemsPage?.items])

  const totalItems = itemsPage?.total ?? job?.item_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))

  const previewText = (item: ImportItem) => {
    const n = item.normalized || {}
    const author = String(n.name || 'Neighbour')
    if (item.kind === 'USER') {
      return `${author} · ${maskPhone(n.phone)} (private)`
    }
    if (item.kind === 'LISTING') {
      const cat = n.category ? ` · ${String(n.category)}` : ''
      return `${author}${cat}: ${String(n.title || n.content || '')}`
    }
    if (item.kind === 'COMMENT') {
      return `${author}: ${String(n.content || '')}`
    }
    if (item.kind === 'SKIP') {
      return `${author}: ${String(n.content || '')}${
        item.reject_reason ? ` — ${item.reject_reason}` : ''
      }`
    }
    const postCatRaw = n.post_category ? String(n.post_category) : ''
    const postCatLabel =
      postCatRaw === 'HELP' ? 'Request' : postCatRaw.replaceAll('_', ' ')
    const postCat = postCatLabel ? ` · ${postCatLabel}` : ''
    const svc = n.is_service_recommendation ? ' · service ask' : ''
    return `${author}${postCat}${svc}: ${String(n.content || '')}`
  }

  return (
    <div className="space-y-6">
      <Card className="eljiran-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Chat import
          </CardTitle>
          <CardDescription>
            Upload a WhatsApp (.txt/.zip) or Telegram (result.json) group export. Parse builds
            parent posts with nested comments, classifies Arabic/English listings (cheap LLM when
            configured), and keeps phone numbers private — contact/profile names are used instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Compound</Label>
              <Select value={compoundId} onValueChange={setCompoundId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select compound" />
                </SelectTrigger>
                <SelectContent>
                  {compounds.map((compound) => (
                    <SelectItem key={compound.id} value={String(compound.id)}>
                      {formatCompoundWithArea(compound.name, compound.area)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={source} onValueChange={(value) => setSource(value as Source)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="TELEGRAM">Telegram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Export file</Label>
              <Input
                type="file"
                accept=".txt,.zip,.json"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!compoundId || !file || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="eljiran-card border-0 h-fit">
          <CardHeader>
            <CardTitle className="text-base">Recent jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              jobs.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setActiveJobId(row.id)
                    setItemPage(0)
                  }}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    activeJobId === row.id
                      ? 'border-primary bg-secondary'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <div className="font-medium">#{row.id} · {row.source}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.status} · {row.original_filename || 'file'}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="eljiran-card border-0">
          <CardHeader>
            <CardTitle className="text-base">
              {activeJobId ? `Job #${activeJobId}` : 'Select a job'}
            </CardTitle>
            {job ? (
              <CardDescription>
                Status: {job.status}
                {typeof job.item_count === 'number' ? ` · ${job.item_count} items` : ''}
                {job.error_message ? ` · ${job.error_message}` : ''}
                {job.stats ? ` · ${JSON.stringify(job.stats)}` : ''}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeJobId ? (
              <p className="text-sm text-muted-foreground">Upload or pick a job to continue.</p>
            ) : jobLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : job ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={parseMutation.isPending || job.status === 'PARSING'}
                    onClick={() => parseMutation.mutate(job.id)}
                  >
                    {parseMutation.isPending || job.status === 'PARSING' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {job.status === 'PARSING' ? 'Parsing…' : 'Parse'}
                  </Button>
                  <Button
                    disabled={publishMutation.isPending || job.status === 'PUBLISHING'}
                    onClick={() => publishMutation.mutate(job.id)}
                  >
                    {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Publish approved
                  </Button>
                  <Button
                    variant="outline"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(job.id)}
                  >
                    Discard
                  </Button>
                  <Select
                    value={kindFilter}
                    onValueChange={(value) => {
                      setKindFilter(value as any)
                      setItemPage(0)
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All kinds</SelectItem>
                      <SelectItem value="USER">Users</SelectItem>
                      <SelectItem value="POST">Posts</SelectItem>
                      <SelectItem value="COMMENT">Comments</SelectItem>
                      <SelectItem value="LISTING">Listings</SelectItem>
                      <SelectItem value="SKIP">Skipped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  {itemsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Kind</th>
                        <th className="px-3 py-2 font-medium">Preview</th>
                        <th className="px-3 py-2 font-medium">Decision</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                            No items on this page.
                          </td>
                        </tr>
                      ) : null}
                      {visibleItems.map((item) => (
                        <tr key={item.id} className="border-t border-border align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.kind}</div>
                            {item.kind === 'COMMENT' ? (
                              <div className="text-xs text-muted-foreground">↳ under post</div>
                            ) : null}
                            {item.published_entity_id ? (
                              <div className="text-xs text-muted-foreground">
                                published {item.published_entity_type} #{item.published_entity_id}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 max-w-md">
                            <p
                              className={cn(
                                'whitespace-pre-wrap break-words text-muted-foreground',
                                item.kind === 'COMMENT' && 'pl-4 border-l-2 border-border',
                              )}
                            >
                              {previewText(item)}
                            </p>
                          </td>
                          <td className="px-3 py-2">{item.decision}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!!item.published_entity_id || patchMutation.isPending}
                                onClick={() =>
                                  patchMutation.mutate([{ id: item.id, decision: 'APPROVED' }])
                                }
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!!item.published_entity_id || patchMutation.isPending}
                                onClick={() =>
                                  patchMutation.mutate([{ id: item.id, decision: 'REJECTED' }])
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              {item.kind === 'POST' || item.kind === 'LISTING' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!item.published_entity_id || patchMutation.isPending}
                                  onClick={() =>
                                    patchMutation.mutate([
                                      {
                                        id: item.id,
                                        decision: 'APPROVED',
                                        kind: item.kind === 'POST' ? 'LISTING' : 'POST',
                                      },
                                    ])
                                  }
                                >
                                  → {item.kind === 'POST' ? 'Listing' : 'Post'}
                                </Button>
                              ) : null}
                              {item.kind === 'COMMENT' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!item.published_entity_id || patchMutation.isPending}
                                  onClick={() =>
                                    patchMutation.mutate([
                                      {
                                        id: item.id,
                                        decision: 'APPROVED',
                                        kind: 'POST',
                                      },
                                    ])
                                  }
                                >
                                  → Post
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )}
                </div>
                {totalItems > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>
                      Showing {itemPage * PAGE_SIZE + 1}–
                      {Math.min((itemPage + 1) * PAGE_SIZE, totalItems)} of {totalItems}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={itemPage <= 0 || itemsLoading}
                        onClick={() => setItemPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={itemPage + 1 >= totalPages || itemsLoading}
                        onClick={() => setItemPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
