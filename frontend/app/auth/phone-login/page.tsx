'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizePhone } from '@hoodna/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import Link from 'next/link'
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

export default function PhoneLoginPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setError(t('auth.enterPhone'))
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/api/auth/start', { phone: normalized })
      const params = new URLSearchParams({ phone: normalized })
      const otpCode = response.data?.otp_code
      if (otpCode && /^\d{6}$/.test(otpCode)) {
        params.set('otpCode', otpCode)
      }
      router.push(`/auth/otp-verify?${params.toString()}`)
    } catch (err: any) {
      setError(otpErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.phoneLogin')}</CardTitle>
          <CardDescription>{t('auth.enterPhoneSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">{t('auth.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.phonePlaceholder')}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.sendCode')}
            </Button>
            <div className="text-center text-sm space-y-2">
              <div>
                <Link href="/auth/login" className="text-primary hover:underline">
                  {t('auth.signInWithEmail')}
                </Link>
              </div>
              <div>
                <Link href="/auth/forgot-password" className="text-primary hover:underline">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
