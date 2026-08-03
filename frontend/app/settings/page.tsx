'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/locale-provider'
import { LanguagePicker } from '@/components/language-picker'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { AccountShell } from '@/components/account-shell'
import { AppShell, PageLayout } from '@/components/ui/page-layout'
import { LaunchAccountSettings } from '@/components/launch-account-settings'
import { SampleContentSettings } from '@/components/sample-content-settings'

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setPhone(user.phone || '')
  }, [user])

  if (isLoading) {
    return (
      <AppShell>
        <PageLayout width="md" className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </PageLayout>
      </AppShell>
    )
  }

  if (!user) {
    return (
      <AppShell>
        <PageLayout width="md" className="flex min-h-[50vh] items-center justify-center">
          <Card className="eljiran-card w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="mb-4 text-muted-foreground">{t('auth.pleaseSignIn')}</p>
            </CardContent>
          </Card>
        </PageLayout>
      </AppShell>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/api/auth/me', {
        name: name.trim(),
        phone: phone.trim() || null,
      })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      toast({
        title: t('settings.saved'),
        description: t('settings.savedDescription'),
        variant: 'success',
      })
    } catch (error: any) {
      toast({
        title: t('settings.saveFailed'),
        description: error?.response?.data?.detail || t('settings.saveFailedDescription'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AccountShell title={t('settings.title')} description={t('settings.description')}>
      <Card className="eljiran-card">
        <CardHeader>
          <CardTitle>{t('settings.profileSettings')}</CardTitle>
          <CardDescription>{t('settings.profileDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LanguagePicker />
          <div className="space-y-2">
            <Label htmlFor="name">{t('settings.fullName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.fullNamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('settings.email')}</Label>
            <Input id="email" type="email" value={user.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">{t('settings.emailCannotChange')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('settings.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('settings.phonePlaceholder')}
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setName(user.name || '')
                setPhone(user.phone || '')
              }}
            >
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || name.trim() === ''}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('settings.save')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      {user.role === 'ADMIN' ? <SampleContentSettings /> : null}
      <LaunchAccountSettings />
    </AccountShell>
  )
}
