'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import Link from 'next/link'
import Cookies from 'js-cookie'
import { useFeatureConfig } from '@/components/feature-config-provider'
import { track } from '@/lib/telemetry'
import { useTranslation } from '@/components/locale-provider'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: 'Invalid email address',
    }),
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

      const response = await api.post('/api/auth/signup', {
        name: data.name,
        phone: data.phone,
        password: data.password,
        ...(data.email?.trim() ? { email: data.email.trim() } : {}),
        ...(referralCode ? { referral_code: referralCode } : {}),
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Registration is paused</CardTitle><CardDescription>New account registration is not available right now. Please check back soon.</CardDescription></CardHeader>
          <CardContent><Link href="/auth/login"><Button variant="outline" className="w-full">Sign in</Button></Link></CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Join your verified neighborhood community</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm space-y-2">
                <p>{error}</p>
                {/already registered/i.test(error) && (
                  <p>
                    <Link href="/auth/phone-login" className="text-primary hover:underline">
                      {t('auth.continueWithPhone')}
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
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="John Doe"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                placeholder="Mobile with country code"
              />
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
            <div className="text-center text-sm">
              <span className="text-gray-600">Already have an account? </span>
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
