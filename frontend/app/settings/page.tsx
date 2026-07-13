'use client'

import { useEffect, useState } from 'react'
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

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
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
              <p className="mb-4 text-muted-foreground">Please sign in to access settings.</p>
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
        title: 'Settings saved',
        description: 'Your profile has been updated.',
        variant: 'success',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to save',
        description: error?.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AccountShell title="Settings" description="Update your account and preferences.">
      <Card className="eljiran-card">
        <CardHeader>
          <CardTitle>Profile settings</CardTitle>
          <CardDescription>Update your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+20 123 456 7890"
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
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || name.trim() === ''}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      <LaunchAccountSettings />
    </AccountShell>
  )
}
