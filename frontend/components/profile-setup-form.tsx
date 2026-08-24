'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { getPostAuthWebRoute } from '@/lib/resident-routing'

export function ProfileSetupForm() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [name, setName] = useState(user?.name && !user.name.startsWith('phone_') ? user.name : '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  if (!user?.needs_profile_setup) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      toast({ title: 'Enter your name', variant: 'destructive' })
      return
    }
    if (password.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' })
      return
    }
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await api.post('/api/auth/me/complete-profile', {
        name: trimmed,
        password,
      })
      const refreshed = await refreshUser()
      const nextUser = refreshed.data || { ...user, needs_profile_setup: false }
      toast({
        title: 'Profile complete',
        description: 'Welcome to your compound community.',
      })
      router.replace(getPostAuthWebRoute(nextUser))
    } catch (error: any) {
      toast({
        title: 'Could not save profile',
        description: error?.response?.data?.detail || error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="eljiran-card border-primary/30">
      <CardHeader>
        <CardTitle>Finish setting up your account</CardTitle>
        <CardDescription>
          Your compound access was prepared by an admin from the group chat.
          Add your name and choose a password to continue. Email is not required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {user.phone ? (
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={user.phone} disabled className="bg-muted" />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="setup-name">Full name</Label>
            <Input
              id="setup-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-password">Password</Label>
            <Input
              id="setup-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-confirm">Confirm password</Label>
            <Input
              id="setup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save and continue
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
