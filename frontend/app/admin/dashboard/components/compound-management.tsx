'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Camera, Loader2, Search } from 'lucide-react'

import { SignedFileImage } from '@/components/signed-file'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { resolveUploadContentType, uploadToPresignedUrl } from '@/lib/upload'

interface CompoundRow {
  id: number
  compound_id?: string | null
  name: string
  area?: string | null
  developer?: string | null
  status_2025?: string | null
  hero_image_url?: string | null
}

const STATUS_OPTIONS = [
  'Ready to Move',
  'Under Construction',
  'Mixed/Phased',
]

function isPending(compound: CompoundRow) {
  return !compound.compound_id || !compound.area || !compound.status_2025
}

export default function CompoundManagement() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<CompoundRow | null>(null)
  const [form, setForm] = useState({
    name: '',
    area: '',
    developer: '',
    status_2025: '',
    hero_image_url: '',
  })
  const [uploading, setUploading] = useState(false)
  const pageSize = 25

  const { data, isLoading } = useQuery({
    queryKey: ['admin-compounds', search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        skip: String(page * pageSize),
      })
      if (search.trim()) params.set('q', search.trim())
      const response = await api.get(`/api/admin/compounds?${params}`)
      return response.data as { items: CompoundRow[]; total: number }
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return
      await api.patch(`/api/admin/compounds/${editing.id}`, {
        name: form.name || undefined,
        area: form.area || undefined,
        developer: form.developer || undefined,
        status_2025: form.status_2025 || undefined,
        hero_image_url: form.hero_image_url || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-compounds'] })
      queryClient.invalidateQueries({ queryKey: ['feed-summary'] })
      toast({ title: 'Compound updated', variant: 'success' })
      setEditing(null)
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast({
        title: 'Could not save compound',
        description: error?.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const compounds = useMemo(() => data?.items ?? [], [data?.items])
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pendingCount = useMemo(
    () => compounds.filter(isPending).length,
    [compounds]
  )

  function openEditor(compound: CompoundRow) {
    setEditing(compound)
    setForm({
      name: compound.name || '',
      area: compound.area || '',
      developer: compound.developer || '',
      status_2025: compound.status_2025 || '',
      hero_image_url: compound.hero_image_url || '',
    })
  }

  async function handleHeroUpload(file: File) {
    if (!editing) return
    setUploading(true)
    try {
      const contentType = resolveUploadContentType(file)
      const presign = await api.post(`/api/admin/compounds/${editing.id}/hero/presign`, {
        file_name: file.name,
        file_type: contentType,
      })
      await uploadToPresignedUrl(presign.data.presigned_url, file, contentType)
      setForm((prev) => ({ ...prev, hero_image_url: presign.data.file_url }))
      toast({ title: 'Hero image uploaded', description: 'Save to apply to the feed banner.', variant: 'success' })
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload hero image.', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="eljiran-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary" />
            Compound management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Add hero photos for each compound — they appear on the community feed for residents.
            {pendingCount > 0 ? ` ${pendingCount} on this page need completion.` : ''}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
              placeholder="Search compounds…"
              className="eljiran-search pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading compounds…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[16px] border border-border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Compound</th>
                    <th className="px-4 py-3 font-semibold">Area</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Hero</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {compounds.map((compound) => (
                    <tr key={compound.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{compound.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {compound.compound_id || 'Pending slug'}
                        </div>
                        {isPending(compound) ? (
                          <span className="mt-1 inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                            Needs completion
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{compound.area || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{compound.status_2025 || '—'}</td>
                      <td className="px-4 py-3">
                        {compound.hero_image_url ? (
                          <div className="relative h-12 w-20 overflow-hidden rounded-lg">
                            <SignedFileImage
                              fileUrl={compound.hero_image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No image</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" onClick={() => openEditor(compound)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} compound{total === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? formatCompoundWithArea(editing.name, editing.area) : 'Edit compound'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="compound-name">Name</Label>
              <Input
                id="compound-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compound-area">Area</Label>
              <Input
                id="compound-area"
                value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compound-developer">Developer</Label>
              <Input
                id="compound-developer"
                value={form.developer}
                onChange={(e) => setForm((f) => ({ ...f, developer: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status_2025 || 'none'}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, status_2025: value === 'none' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Feed hero image</Label>
              <p className="text-xs text-muted-foreground">
                Shown at the top of the community feed for residents in this compound.
              </p>
              {form.hero_image_url ? (
                <div className="relative aspect-[21/9] overflow-hidden rounded-[16px] border border-border">
                  <SignedFileImage
                    fileUrl={form.hero_image_url}
                    alt="Compound hero preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <label className="inline-flex cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleHeroUpload(file)
                    event.target.value = ''
                  }}
                />
                <Button type="button" variant="outline" disabled={uploading} asChild>
                  <span>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {form.hero_image_url ? 'Replace hero image' : 'Upload hero image'}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save compound
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
