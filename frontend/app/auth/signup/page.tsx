'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import Link from 'next/link'
import Cookies from 'js-cookie'
import { useFeatureConfig } from '@/components/feature-config-provider'
import { track } from '@/lib/telemetry'
import { useTranslation } from '@/components/locale-provider'
import { AuthStage } from '@/components/auth-stage'
import { passwordSchema } from '@hoodna/shared'
import { getWebFirstTouch } from '@/lib/attribution-store'

const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    phone: z.string().trim().optional(),
    password: passwordSchema,
    email: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || z.string().email().safeParse(v).success, {
        message: 'Invalid email address',
      }),
  })
  .superRefine((value, ctx) => {
    const phoneDigits = (value.phone || '').replace(/\D/g, '')
    const email = (value.email || '').trim()
    if (phoneDigits.length < 7 && !email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Enter a phone number or an email address',
      })
    } else if (value.phone?.trim() && phoneDigits.length < 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Invalid phone number',
      })
    }
  })

type SignupForm = z.infer<typeof signupSchema>

export default function SignupPage() {
  const searchParams = useSearchParams()
  const { isEnabled, isLoading: flagsLoading } = useFeatureConfig()
  const { t } = useTranslation()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const referralCode = searchParams?.get?.('ref')?.trim() || ''

  // Security: Remove sensitive data from URL immediately
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const hasSensitiveData = url.searchParams.has('password')
      
      if (hasSensitiveData) {
        // Remove password and other sensitive params from URL
        url.searchParams.delete('password')
        // Replace URL without sensitive data
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [])

  useEffect(() => {
    track('registration_started', {
      method: 'email',
      referral_present: Boolean(referralCode),
      source_screen: 'signup',
    })
  }, [referralCode])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      // Only pre-fill safe fields (name, email, phone) - NEVER password
      name: searchParams?.get?.('name') || '',
      email: searchParams?.get?.('email') || '',
      phone: searchParams?.get?.('phone') || '',
      password: '', // Always empty - never from URL
    },
  })

  const onSubmit = async (data: SignupForm) => {
    setError('')
    setLoading(true)

    try {
      // Clear any existing cookies first to prevent cross-user issues
      Cookies.remove('access_token', { path: '/' })
      Cookies.remove('refresh_token', { path: '/' })

      const firstTouch = getWebFirstTouch()
      const response = await api.post('/api/auth/signup', {
        name: data.name,
        password: data.password,
        ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
        ...(data.email?.trim() ? { email: data.email.trim() } : {}),
        ...(referralCode || firstTouch?.referralCode
          ? { referral_code: referralCode || firstTouch?.referralCode }
          : {}),
        platform: 'web',
        ...(firstTouch?.attribution && Object.keys(firstTouch.attribution).length
          ? { attribution: firstTouch.attribution }
          : {}),
      })
      const { access_token, refresh_token } = response.data

      if (!access_token || !refresh_token) {
        setError('Failed to receive authentication tokens')
        return
      }

      // Store tokens in cookies with proper options
      Cookies.set('access_token', access_token, {
        expires: 30, // 30 days
        path: '/',
        sameSite: 'lax',
      })
      Cookies.set('refresh_token', refresh_token, {
        expires: 30, // 30 days
        path: '/',
        sameSite: 'lax',
      })

      // Verify token was stored correctly
      const storedToken = Cookies.get('access_token')
      if (!storedToken || storedToken !== access_token) {
        setError('Failed to store authentication token')
        return
      }

      track('registration_completed', { method: 'email', source_screen: 'signup' })
      if (referralCode) {
        track('referral_registration_completed', { source_screen: 'signup' })
      }
      window.location.href = '/auth/verify-contact'
    } catch (err: any) {
      const detail = String(err.response?.data?.detail || 'Signup failed')
      setError(/already registered/i.test(detail) ? t('auth.phoneAlreadyRegisteredHint') : detail)
      // Clear cookies on error
      Cookies.remove('access_token', { path: '/' })
      Cookies.remove('refresh_token', { path: '/' })
    } finally {
      setLoading(false)
    }
  }

  if (!flagsLoading && !isEnabled('user_registration')) {
    return (
      <AuthStage scene="join" title={t('auth.registrationPaused')} subtitle={t('auth.registrationPausedDesc')}>
        <Link href="/auth/login">
          <Button variant="outline" className="w-full">{t('auth.signIn')}</Button>
        </Link>
      </AuthStage>
    )
  }

  return (
    <AuthStage scene="join" title={t('auth.signUp')} subtitle={t('auth.signupSubtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm space-y-2">
                <p>{error}</p>
                {/already registered/i.test(error) && (
                  <p>
                    <Link href="/auth/login" className="text-primary hover:underline">
                      {t('auth.signIn')}
                    </Link>
                  </p>
                )}
              </div>
            )}
            {referralCode ? (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800" role="status">
                Neighbour invite applied.
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.fullName')}</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder={t('auth.fullNamePlaceholder')}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t('auth.signupContactHint')}</p>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('auth.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                placeholder={t('auth.phonePlaceholder')}
              />
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder={t('auth.emailPlaceholder')}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder={t('auth.passwordPlaceholder')}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.signingUp') : t('auth.signUp')}
            </Button>
            <div className="text-center text-sm">
              <span className="text-muted-foreground">{t('auth.alreadyHaveAccount')} </span>
              <Link href="/auth/login" className="text-primary hover:underline">
                {t('auth.signIn')}
              </Link>
            </div>
          </form>
    </AuthStage>
  )
}
