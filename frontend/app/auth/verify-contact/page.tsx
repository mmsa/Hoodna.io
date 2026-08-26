'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { getPostAuthWebRoute, needsContactVerification } from '@/lib/resident-routing'
import { SignOutButton } from '@/components/sign-out-button'
import { toast } from 'sonner'

export default function VerifyContactPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isLoading: userLoading } = useAuth()
  const [phoneOtp, setPhoneOtp] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)

  const needsPhone = user?.phone_verified === false
  const needsEmail = user?.email_verified === false
  const placeholderEmail = Boolean(user?.email?.endsWith('@hoodna.local'))

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      router.replace('/auth/login')
      return
    }
    if (!needsContactVerification(user)) {
      router.replace(getPostAuthWebRoute(user))
    }
  }, [user, userLoading, router])

  async function refreshAndContinue() {
    await queryClient.invalidateQueries({ queryKey: ['current-user'] })
    const me = await api.get('/api/auth/me')
    if (!needsContactVerification(me.data)) {
      router.replace(getPostAuthWebRoute(me.data))
    }
  }

  async function confirmPhone() {
    if (!phoneOtp.trim()) {
      toast.error('Enter the phone verification code')
      return
    }
    setPhoneBusy(true)
    try {
      await api.post('/api/auth/confirm-phone', { otp_code: phoneOtp.trim() })
      toast.success('Phone verified')
      setPhoneOtp('')
      await refreshAndContinue()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid or expired phone code')
    } finally {
      setPhoneBusy(false)
    }
  }

  async function confirmEmail() {
    if (!emailOtp.trim()) {
      toast.error('Enter the email verification code')
      return
    }
    setEmailBusy(true)
    try {
      await api.post('/api/auth/confirm-email', { otp_code: emailOtp.trim() })
      toast.success('Email verified')
      setEmailOtp('')
      await refreshAndContinue()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid or expired email code')
    } finally {
      setEmailBusy(false)
    }
  }

  async function resendCodes() {
    setResendBusy(true)
    try {
      const res = await api.post('/api/auth/resend-contact-otp')
      toast.success('Verification code(s) sent')
      if (res.data?.dev_phone_otp) {
        toast.message(`Dev phone OTP: ${res.data.dev_phone_otp}`)
      }
      if (res.data?.dev_email_otp) {
        toast.message(`Dev email OTP: ${res.data.dev_email_otp}`)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not resend codes')
    } finally {
      setResendBusy(false)
    }
  }

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify your contact details</CardTitle>
          <CardDescription>
            Confirm your phone{needsEmail && !placeholderEmail ? ' and email' : ''} before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {needsPhone ? (
            <div className="space-y-2">
              <Label htmlFor="phone-otp">Phone code{user.phone ? ` (${user.phone})` : ''}</Label>
              <Input
                id="phone-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              />
              <Button className="w-full" onClick={confirmPhone} disabled={phoneBusy}>
                {phoneBusy ? 'Verifying…' : 'Verify phone'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-green-700">Phone verified</p>
          )}

          {needsEmail && !placeholderEmail ? (
            <div className="space-y-2">
              <Label htmlFor="email-otp">Email code ({user.email})</Label>
              <Input
                id="email-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              />
              <Button className="w-full" onClick={confirmEmail} disabled={emailBusy}>
                {emailBusy ? 'Verifying…' : 'Verify email'}
              </Button>
            </div>
          ) : null}

          <Button variant="outline" className="w-full" onClick={resendCodes} disabled={resendBusy}>
            {resendBusy ? 'Sending…' : 'Resend codes'}
          </Button>

          <SignOutButton className="w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
