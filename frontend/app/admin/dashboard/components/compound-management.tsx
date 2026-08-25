'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Camera, ExternalLink, ImageIcon, Loader2, Plus, Search, Trash2 } from 'lucide-react'

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
import { useAuth } from '@/hooks/use-auth'
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

const EMPTY_FORM = {
  name: '',
  area: '',
  developer: '',
  hero_image_url: '',
}

function isPending(compound: CompoundRow) {
  return !compound.compound_id || !compound.area
}

function buildGoogleImagesSearchUrl(name: string, area?: string | null) {
  const query = `${name} ${area || ''} Egypt compound`.replace(/\s+/g, ' ').trim()
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`
}

function openGoogleImagesSuggest(name: string, area?: string | null) {
  const trimmed = name.trim()
  if (!trimmed) return
  window.open(buildGoogleImagesSearchUrl(trimmed, area), '_blank', 'noopener,noreferrer')
}

function errorDetail(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Please try again.'
}

export default function CompoundManagement() {
  const { toast } = useToast()
  const router = useRouter()
  const { refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<CompoundRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<CompoundRow | null>(null)
  const [forceDelete, setForceDelete] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const pageSize = 25

  const dialogOpen = creating || !!editing

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
      const payload = {
        name: form.name.trim(),
        area: form.area.trim() || undefined,
        developer: form.developer.trim() || undefined,
        // App only supports operating compounds; keep catalog field filled for completeness checks.
        status_2025: 'Ready to Move',
        hero_image_url: form.hero_image_url || undefined,
      }
      if (!payload.name) {
        throw new Error('Name is required')
      }
      if (creating) {
        const response = await api.post('/api/admin/compounds', payload)
        return response.data as CompoundRow
      }
      if (!editing) return null
      await api.patch(`/api/admin/compounds/${editing.id}`, payload)
      return editing
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-compounds'] })
      queryClient.invalidateQueries({ queryKey: ['feed-summary'] })
      toast({
        title: creating ? 'Compound created' : 'Compound updated',
        variant: 'success',
      })
      closeEditor()
    },
    onError: (error: unknown) => {
      toast({
        title: creating ? 'Could not create compound' : 'Could not save compound',
        description: error instanceof Error && !('response' in error)
          ? error.message
          : errorDetail(error),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return
      await api.delete(`/api/admin/compounds/${deleting.id}`, {
        params: forceDelete ? { force: true } : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-compounds'] })
      queryClient.invalidateQueries({ queryKey: ['feed-summary'] })
      toast({ title: 'Compound deleted', variant: 'success' })
      setDeleting(null)
      setForceDelete(false)
    },
    onError: (error: unknown) => {
      const detail = errorDetail(error)
      if (/force=true/i.test(detail)) {
        setForceDelete(true)
      }
      toast({
        title: 'Could not delete compound',
        description: detail,
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

  function closeEditor() {
    setCreating(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setForm(EMPTY_FORM)
  }

  function openEditor(compound: CompoundRow) {
    setCreating(false)
    setEditing(compound)
    setForm({
      name: compound.name || '',
      area: compound.area || '',
      developer: compound.developer || '',
      hero_image_url: compound.hero_image_url || '',
    })
  }

  async function handleHeroUpload(file: File) {
    if (!editing) {
      toast({
        title: 'Save the compound first',
        description: 'Create the compound, then edit it to upload a hero image.',
        variant: 'destructive',
      })
      return
    }
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

  async function goToCompound(compound: CompoundRow) {
    setOpeningId(compound.id)
    try {
      await api.post('/api/auth/me/switch-compound', { compound_id: compound.id })
      await refreshUser()
      queryClient.invalidateQueries({ queryKey: ['compound'] })
      queryClient.invalidateQueries({ queryKey: ['user-compounds'] })
      for (const key of [
        'feed',
        'feed-summary',
        'announcements',
        'recent-listings',
        'latest-for-sale',
        'latest-for-rent',
        'latest-services',
        'user-stats',
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      toast({
        title: 'Switched neighbourhood',
        description: `Browsing ${formatCompoundWithArea(compound.name, compound.area)}`,
        variant: 'success',
      })
      router.push('/feed')
    } catch (error: unknown) {
      toast({
        title: 'Could not open compound',
        description: errorDetail(error),
        variant: 'destructive',
      })
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="eljiran-card border-0">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" />
                Compound management
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Add, edit, or delete compounds. Use Open to browse that neighbourhood as admin.
                {pendingCount > 0 ? ` ${pendingCount} on this page need completion.` : ''}
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add compound
            </Button>
          </div>
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
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => void goToCompound(compound)}
                            disabled={openingId === compound.id}
                          >
                            {openingId === compound.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5" />
                            )}
                            Open
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditor(compound)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!compound.name.trim()}
                            onClick={() => openGoogleImagesSuggest(compound.name, compound.area)}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            Suggest hero
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleting(compound)
                              setForceDelete(false)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {creating
                ? 'Add compound'
                : editing
                  ? formatCompoundWithArea(editing.name, editing.area)
                  : 'Edit compound'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="compound-name">Name</Label>
              <Input
                id="compound-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Madinaty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compound-area">Area</Label>
              <Input
                id="compound-area"
                value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                placeholder="e.g. New Cairo"
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

            {!creating ? (
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!form.name.trim()}
                    onClick={() => openGoogleImagesSuggest(form.name, form.area)}
                  >
                    <ImageIcon className="h-4 w-4" />
                    Suggest hero
                  </Button>
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
                <p className="text-xs text-muted-foreground">
                  Suggest opens Google Images for this compound. Download a photo, then upload it here.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                After creating, edit the compound to upload a feed hero image.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name.trim()}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {creating ? 'Create compound' : 'Save compound'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            setForceDelete(false)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete compound?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              This will permanently remove{' '}
              <span className="font-semibold text-foreground">{deleting?.name}</span>
              {deleting?.area ? ` (${deleting.area})` : ''}.
            </p>
            {forceDelete ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
                This compound still has linked users, posts, or listings. Confirming will clear
                user links and delete related content.
              </p>
            ) : (
              <p>Deletion is blocked if the compound still has linked data, unless you force it.</p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleting(null)
                setForceDelete(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {forceDelete ? 'Force delete' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
