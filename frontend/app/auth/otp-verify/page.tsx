'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizePhone } from '@hoodna/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api, { persistAuthTokens, persistUserRole, clearAuthTokens } from '@/lib/api'
import Link from 'next/link'
import { getPostAuthWebRoute } from '@/lib/resident-routing'
import { useTranslation } from '@/components/locale-provider'

function otpErrorMessage(err: any, t: (key: any) => string): string {
  const status = err?.response?.status
  const detail = String(err?.response?.data?.detail || err?.message || '')
  const lower = detail.toLowerCase()
  if (status === 429 || lower.includes('too many')) return t('auth.otpRateLimited')
  if (status === 503 || lower.includes('not configured') || lower.includes('unavailable')) {
    return t('auth.otpNotConfigured')
  }
  if (detail.trim()) return detail
  return t('auth.otpFailed')
}

function OtpVerifyForm() {
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const phoneParam = searchParams?.get?.('phone') || ''
  const initialOtp = searchParams?.get?.('otpCode') || ''
  const [otp, setOtp] = useState(/^\d{6}$/.test(initialOtp) ? initialOtp : '')
  const [name, setName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const resend = async () => {
    const normalized = normalizePhone(phoneParam)
    if (!normalized) {
      setError(t('auth.enterPhone'))
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/api/auth/start', { phone: normalized })
      setOtp('')
    } catch (err: any) {
      setError(otpErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const normalized = normalizePhone(phoneParam)
    if (!normalized) {
      setError(t('auth.enterPhone'))
      return
    }
    if (!otp.trim()) {
      setError(t('auth.enterOtp'))
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/api/auth/verify', {
        phone: normalized,
        otp_code: otp.trim(),
        name: showNameInput ? name.trim() : undefined,
      })
      const { access_token, refresh_token } = response.data
      if (!access_token || !refresh_token || !persistAuthTokens(access_token, refresh_token)) {
        setError('Failed to store authentication token')
        return
      }
      const me = await api.get('/api/auth/me')
      persistUserRole(me.data?.role)
      window.location.href = getPostAuthWebRoute(me.data)
    } catch (err: any) {
      const detail = String(err?.response?.data?.detail || err?.message || '')
      if (detail.toLowerCase().includes('name is required')) {
        setShowNameInput(true)
        setError(t('auth.nameRequiredForNewAccount'))
      } else {
        setError(detail || t('auth.otpVerifyFailed'))
        clearAuthTokens()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.verifyCode')}</CardTitle>
          <CardDescription>{t('auth.otpSentTo', { phone: phoneParam || '…' })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
            )}
            {showNameInput && (
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.fullName')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.fullNamePlaceholder')}
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="otp">{t('auth.enterOtp')}</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('auth.otpPlaceholder')}
                className="text-center tracking-[0.4em] text-lg"
                autoFocus={!showNameInput}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.verifyCode')}
            </Button>
            <div className="text-center text-sm space-y-2">
              <button
                type="button"
                className="text-primary hover:underline disabled:opacity-50"
                onClick={resend}
                disabled={loading}
              >
                {t('auth.resendCode')}
              </button>
              <div>
                <Link href="/auth/phone-login" className="text-gray-600 hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function OtpVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center text-gray-600">Loading...</CardContent>
          </Card>
        </div>
      }
    >
      <OtpVerifyForm />
    </Suspense>
  )
}
