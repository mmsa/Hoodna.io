'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/components/locale-provider'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { formatCompoundName } from '@/lib/format-compound'
import api from '@/lib/api'

interface SampleContentStatus {
  loaded: boolean
  can_load: boolean
  reason?: string | null
}

interface Compound {
  id: number
  name: string
  area?: string
  city?: string
  country: string
}

export function SampleContentSettings() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<'load' | 'unload' | null>(null)
  const [selectedCompoundId, setSelectedCompoundId] = useState<number | null>(null)

  const hasNeighbourhood = Boolean(user?.compound_id)

  const compoundsQuery = useQuery({
    queryKey: ['compounds'],
    queryFn: async () => {
      const response = await api.get('/api/compounds?limit=200')
      return response.data as { items: Compound[]; total: number }
    },
    enabled: !hasNeighbourhood,
  })

  const compoundOptions: ComboboxOption[] = useMemo(() => {
    return (compoundsQuery.data?.items ?? []).map((compound) => ({
      value: compound.id,
      label: formatCompoundName(compound.name),
      description: `${compound.area || compound.city || ''}, ${compound.country}`.replace(/^, /, ''),
    }))
  }, [compoundsQuery.data?.items])

  const selectCompoundMutation = useMutation({
    mutationFn: async (compoundId: number) => {
      const response = await api.patch('/api/auth/me', { compound_id: compoundId })
      return response.data
    },
    onSuccess: async () => {
      await refreshUser()
      queryClient.invalidateQueries({ queryKey: ['sample-content-status'] })
      toast({
        title: t('settings.sampleContentNeighbourhoodSaved'),
        variant: 'success',
      })
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast({
        title: t('settings.saveFailed'),
        description: error?.response?.data?.detail || t('common.retry'),
        variant: 'destructive',
      })
    },
  })

  const statusQuery = useQuery({
    queryKey: ['sample-content-status', user?.compound_id],
    enabled: hasNeighbourhood,
    queryFn: async () => {
      const response = await api.get('/api/auth/me/compound/sample-content')
      return response.data as SampleContentStatus
    },
    retry: false,
  })

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ['sample-content-status'] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
    queryClient.invalidateQueries({ queryKey: ['feed-summary'] })
    queryClient.invalidateQueries({ queryKey: ['recent-listings'] })
    queryClient.invalidateQueries({ queryKey: ['listings'] })
  }

  const loadMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/auth/me/compound/sample-content')
      return response.data as { message: string }
    },
    onSuccess: (data) => {
      invalidateContent()
      toast({
        title: t('settings.sampleContentLoaded'),
        description: data.message,
        variant: 'success',
      })
      setConfirmAction(null)
    },
    onError: (error: { response?: { data?: { detail?: string }; status?: number } }) => {
      toast({
        title: t('settings.sampleContentLoadFailed'),
        description: error?.response?.data?.detail || t('common.retry'),
        variant: 'destructive',
      })
      setConfirmAction(null)
    },
  })

  const unloadMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete('/api/auth/me/compound/sample-content')
      return response.data as { message: string }
    },
    onSuccess: (data) => {
      invalidateContent()
      toast({
        title: t('settings.sampleContentUnloaded'),
        description: data.message,
        variant: 'success',
      })
      setConfirmAction(null)
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast({
        title: t('settings.sampleContentUnloadFailed'),
        description: error?.response?.data?.detail || t('common.retry'),
        variant: 'destructive',
      })
      setConfirmAction(null)
    },
  })

  const busy =
    loadMutation.isPending ||
    unloadMutation.isPending ||
    selectCompoundMutation.isPending
  const status = statusQuery.data
  const apiUnavailable = statusQuery.isError
  const canLoad =
    hasNeighbourhood && !apiUnavailable && status?.can_load !== false
  const canUnload = hasNeighbourhood && !apiUnavailable && Boolean(status?.loaded)

  const helperMessage = (() => {
    if (apiUnavailable) return t('settings.sampleContentBackendUnavailable')
    if (status?.reason) return status.reason
    if (hasNeighbourhood && !canLoad && !status?.loaded) {
      return t('settings.sampleContentLoadUnavailable')
    }
    return null
  })()

  return (
    <>
      <Card className="eljiran-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            {t('settings.sampleContentTitle')}
          </CardTitle>
          <CardDescription>{t('settings.sampleContentDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasNeighbourhood ? (
            <div className="space-y-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900">{t('settings.sampleContentSelectNeighbourhood')}</p>
              <div className="space-y-2">
                <Label htmlFor="sample-content-compound">
                  {t('settings.sampleContentNeighbourhoodLabel')}
                </Label>
                {compoundsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <Combobox
                    options={compoundOptions}
                    value={selectedCompoundId}
                    onValueChange={(value) => {
                      const compoundId = value ? Number(value) : null
                      setSelectedCompoundId(compoundId)
                      if (compoundId) selectCompoundMutation.mutate(compoundId)
                    }}
                    placeholder={t('settings.sampleContentNeighbourhoodPlaceholder')}
                    searchPlaceholder={t('settings.sampleContentNeighbourhoodPlaceholder')}
                    emptyMessage={t('compound.noNeighbourhoods')}
                    className="w-full bg-white"
                  />
                )}
              </div>
            </div>
          ) : null}

          {hasNeighbourhood && statusQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : hasNeighbourhood ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-muted/30 px-4 py-3">
                <span className="text-sm text-muted-foreground">{t('settings.sampleContentStatus')}</span>
                <span
                  className={
                    status?.loaded
                      ? 'rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary'
                      : 'rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'
                  }
                >
                  {status?.loaded
                    ? t('settings.sampleContentLoadedLabel')
                    : t('settings.sampleContentNotLoadedLabel')}
                </span>
              </div>

              {helperMessage ? (
                <p className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {helperMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canLoad || busy}
                  onClick={() => setConfirmAction('load')}
                >
                  {busy && confirmAction === 'load' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {status?.loaded
                    ? t('settings.sampleContentReload')
                    : t('settings.sampleContentLoad')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canUnload || busy}
                  onClick={() => setConfirmAction('unload')}
                >
                  {busy && confirmAction === 'unload' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {t('settings.sampleContentUnload')}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={confirmAction != null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'load'
                ? t('settings.sampleContentLoadConfirmTitle')
                : t('settings.sampleContentUnloadConfirmTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction === 'load'
              ? t('settings.sampleContentLoadConfirmDescription')
              : t('settings.sampleContentUnloadConfirmDescription')}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              {t('settings.cancel')}
            </Button>
            <Button
              variant={confirmAction === 'unload' ? 'destructive' : 'default'}
              disabled={busy}
              onClick={() => {
                if (confirmAction === 'load') loadMutation.mutate()
                else unloadMutation.mutate()
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('settings.sampleContentConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
