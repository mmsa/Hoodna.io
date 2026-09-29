'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MIN_PASSWORD_LENGTH, normalizePhone } from '@hoodna/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import Link from 'next/link'
import { useTranslation } from '@/components/locale-provider'

function recoveryErrorMessage(err: any, fallback: string): string {
  const detail = String(err?.response?.data?.detail || err?.message || '')
  if (detail.trim()) return detail
  return fallback
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [step, setStep] = useState<'request' | 'email' | 'phone'>('request')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  const sendRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const raw = identifier.trim()
    if (!raw) {
      setError(t('auth.enterEmailOrPhone'))
      return
    }
    const payload = raw.includes('@') ? raw.toLowerCase() : normalizePhone(raw)
    if (!payload) {
      setError(t('auth.enterPhone'))
      return
    }
    setLoading(true)
    try {
      const response = await api.post('/api/auth/recover', { identifier: payload })
      if (response.data?.channel === 'email') {
        setStep('email')
        return
      }
      setPhone(typeof payload === 'string' && payload.startsWith('+') ? payload : raw)
      const otpCode = response.data?.otp_code
      if (otpCode && /^\d{6}$/.test(otpCode)) {
        setOtp(otpCode)
      }
      setStep('phone')
    } catch (err: any) {
      setError(recoveryErrorMessage(err, t('auth.otpFailed')))
    } finally {
      setLoading(false)
    }
  }

  const resetWithPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) {
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

  const signInWithCode = () => {
    const params = new URLSearchParams({ phone })
    if (/^\d{6}$/.test(otp)) params.set('otpCode', otp)
    router.push(`/auth/otp-verify?${params.toString()}`)
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
                {t('auth.passwordResetSuccess')}
              </div>
              <div className="text-center text-sm">
                <Link href="/auth/login" className="text-primary hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </div>
          ) : step === 'email' ? (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
                {t('auth.resetLinkSent')}
              </div>
              <div className="text-center text-sm">
                <Link href="/auth/login" className="text-primary hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
              )}

              {step === 'request' ? (
                <form onSubmit={sendRecovery} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="identifier">{t('auth.emailOrPhone')}</Label>
                    <Input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={t('auth.emailOrPhonePlaceholder')}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.signingIn') : t('auth.continueAction')}
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
                  <Button type="button" variant="outline" className="w-full" onClick={signInWithCode}>
                    {t('auth.signInWithCode')}
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
