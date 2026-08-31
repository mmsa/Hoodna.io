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

function otpErrorMessage(err: any, fallback: string): string {
  const status = err?.response?.status
  const detail = String(err?.response?.data?.detail || err?.message || '')
  const lower = detail.toLowerCase()
  if (status === 429 || lower.includes('too many')) return detail
  if (detail.trim()) return detail
  return fallback
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [method, setMethod] = useState<'email' | 'phone'>('phone')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phoneStep, setPhoneStep] = useState<'request' | 'reset'>('request')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  const sendEmailReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (!email.includes('@')) {
      setError(t('auth.validEmailRequired'))
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.resetEmailFailed'))
    } finally {
      setLoading(false)
    }
  }

  const sendPhoneCode = async (e: React.FormEvent) => {
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
      setPhone(normalized)
      const otpCode = response.data?.otp_code
      if (otpCode && /^\d{6}$/.test(otpCode)) {
        setOtp(otpCode)
      }
      setPhoneStep('reset')
    } catch (err: any) {
      setError(otpErrorMessage(err, t('auth.otpFailed')))
    } finally {
      setLoading(false)
    }
  }

  const resetWithPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError(t('auth.passwordMinLength'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsMismatch'))
      return
    }
    if (!otp.trim()) {
      setError(t('auth.enterOtp'))
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password-phone', {
        phone,
        otp_code: otp.trim(),
        new_password: password,
      })
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.passwordResetFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.forgotPasswordTitle')}</CardTitle>
          <CardDescription>{t('auth.forgotPasswordSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
                {method === 'email' ? t('auth.resetLinkSent') : t('auth.passwordResetSuccess')}
              </div>
              <div className="text-center text-sm">
                <Link href="/auth/login" className="text-primary hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={method === 'phone' ? 'default' : 'outline'}
                  onClick={() => {
                    setMethod('phone')
                    setError('')
                    setSuccess(false)
                  }}
                >
                  {t('auth.usePhone')}
                </Button>
                <Button
                  type="button"
                  variant={method === 'email' ? 'default' : 'outline'}
                  onClick={() => {
                    setMethod('email')
                    setError('')
                    setSuccess(false)
                  }}
                >
                  {t('auth.useEmail')}
                </Button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
              )}

              {method === 'email' ? (
                <form onSubmit={sendEmailReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('auth.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.emailPlaceholder')}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.signingIn') : t('auth.sendResetLink')}
                  </Button>
                </form>
              ) : phoneStep === 'request' ? (
                <form onSubmit={sendPhoneCode} className="space-y-4">
                  <p className="text-sm text-gray-600">{t('auth.enterPhoneSubtitle')}</p>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('auth.phone')}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t('auth.phonePlaceholder')}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.signingIn') : t('auth.sendResetCode')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={resetWithPhone} className="space-y-4">
                  <p className="text-sm text-gray-600">{t('auth.resetCodeSent')}</p>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t('auth.newPassword')}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">{t('auth.confirmPassword')}</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.signingIn') : t('auth.resetPassword')}
                  </Button>
                </form>
              )}

              <div className="text-center text-sm">
                <Link href="/auth/login" className="text-primary hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
