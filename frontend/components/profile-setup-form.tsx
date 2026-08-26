'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/components/locale-provider'
import api from '@/lib/api'
import { getPostAuthWebRoute } from '@/lib/resident-routing'
import { formatPhoneDisplay } from '@hoodna/shared'
import { cn } from '@/lib/utils'

type ImportChoice = 'KEEP' | 'DISCARD' | null

export function ProfileSetupForm() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState(user?.name && !user.name.startsWith('phone_') ? user.name : '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [importChoice, setImportChoice] = useState<ImportChoice>(null)
  const [importSummary, setImportSummary] = useState<{
    needs_choice: boolean
    posts: number
    comments: number
    listings: number
    total: number
  } | null>(null)

  const needsImportChoice =
    Boolean(user?.needs_imported_content_choice) ||
    Boolean(importSummary?.needs_choice)

  useEffect(() => {
    if (!user?.needs_profile_setup) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/api/auth/me/imported-content')
        if (!cancelled) setImportSummary(data)
      } catch {
        if (!cancelled) {
          setImportSummary({
            needs_choice: Boolean(user?.needs_imported_content_choice),
            posts: 0,
            comments: 0,
            listings: 0,
            total: 0,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.needs_profile_setup, user?.needs_imported_content_choice])

  if (!user?.needs_profile_setup) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      toast({ title: t('profileSetup.nameRequired'), variant: 'destructive' })
      return
    }
    if (password.length < 8) {
      toast({ title: t('profileSetup.passwordTooShort'), variant: 'destructive' })
      return
    }
    if (password !== confirmPassword) {
      toast({ title: t('profileSetup.passwordsMismatch'), variant: 'destructive' })
      return
    }
    if (needsImportChoice && !importChoice) {
      toast({ title: t('profileSetup.choiceRequired'), variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await api.post('/api/auth/me/complete-profile', {
        name: trimmed,
        password,
        ...(importChoice ? { imported_content_choice: importChoice } : {}),
      })
      const refreshed = await refreshUser()
      const nextUser = refreshed.data || { ...user, needs_profile_setup: false }
      toast({
        title: t('profileSetup.successTitle'),
        description: t('profileSetup.successDesc'),
      })
      router.replace(getPostAuthWebRoute(nextUser))
    } catch (error: any) {
      toast({
        title: t('profileSetup.saveFailed'),
        description: error?.response?.data?.detail || error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const phoneDisplay = formatPhoneDisplay(user.phone) || user.phone

  return (
    <Card className="eljiran-card border-primary/30">
      <CardHeader>
        <CardTitle>{t('profileSetup.title')}</CardTitle>
        <CardDescription>{t('profileSetup.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {user.phone ? (
            <div className="space-y-1">
              <Label>{t('profileSetup.phone')}</Label>
              <Input value={phoneDisplay || ''} disabled className="bg-muted" />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="setup-name">{t('profileSetup.fullName')}</Label>
            <Input
              id="setup-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('profileSetup.namePlaceholder')}
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-password">{t('profileSetup.password')}</Label>
            <Input
              id="setup-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('profileSetup.passwordPlaceholder')}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-confirm">{t('profileSetup.confirmPassword')}</Label>
            <Input
              id="setup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {needsImportChoice ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('profileSetup.importTitle')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('profileSetup.importBody')}
                </p>
                {importSummary && importSummary.total > 0 ? (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {t('profileSetup.importCounts', {
                      posts: importSummary.posts,
                      comments: importSummary.comments,
                      listings: importSummary.listings,
                    })}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setImportChoice('KEEP')}
                className={cn(
                  'w-full rounded-md border px-3 py-3 text-left transition',
                  importChoice === 'KEEP'
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background hover:bg-muted/60'
                )}
              >
                <p className="text-sm font-semibold">{t('profileSetup.keepLabel')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('profileSetup.keepHint')}
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `${t('profileSetup.discardConfirmTitle')}\n\n${t('profileSetup.discardConfirmBody')}`
                    )
                  ) {
                    setImportChoice('DISCARD')
                  }
                }}
                className={cn(
                  'w-full rounded-md border px-3 py-3 text-left transition',
                  importChoice === 'DISCARD'
                    ? 'border-destructive bg-destructive/10'
                    : 'border-border bg-background hover:bg-muted/60'
                )}
              >
                <p className="text-sm font-semibold">{t('profileSetup.discardLabel')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('profileSetup.discardHint')}
                </p>
              </button>
            </div>
          ) : null}

          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('profileSetup.saveContinue')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
