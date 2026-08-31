'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api, { persistAuthTokens, persistUserRole, clearAuthTokens } from '@/lib/api'
import Link from 'next/link'
import { getPostAuthWebRoute } from '@/lib/resident-routing'
import { useTranslation } from '@/components/locale-provider'

const loginSchema = z.object({
  email: z.string().min(3, 'Enter your email or phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('password')) {
        url.searchParams.delete('password')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: searchParams?.get?.('email') || '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginForm) => {
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/api/auth/login', data)
      const { access_token, refresh_token } = response.data

      if (!access_token || !refresh_token) {
        setError('Failed to receive authentication tokens')
        return
      }

      if (!persistAuthTokens(access_token, refresh_token)) {
        setError('Failed to store authentication token')
        return
      }

      const me = await api.get('/api/auth/me')
      persistUserRole(me.data?.role)
      const dest = getPostAuthWebRoute(me.data)
      if (typeof window !== 'undefined') {
        window.location.href = dest
      } else {
        router.push(dest)
      }
    } catch (err: any) {
      if (err.response) {
        const errorDetail = err.response?.data?.detail || err.response?.data?.message || 'Login failed'
        const lower = String(errorDetail).toLowerCase()
        setError(
          lower.includes('verification code') || lower.includes('does not have a password')
            ? t('auth.noPasswordSet')
            : errorDetail
        )
      } else if (err.request) {
        setError('Unable to connect to server. Please check your connection and try again.')
      } else {
        setError(err.message || 'Login failed. Please try again.')
      }
      clearAuthTokens()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.signIn')}</CardTitle>
          <CardDescription>{t('auth.signInSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">{t('auth.importedAccountHint')}</p>
          <Button asChild className="w-full" size="lg">
            <Link href="/auth/phone-login">{t('auth.continueWithPhone')}</Link>
          </Button>
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">{t('auth.orDivider')}</span>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.emailOrPhone')}</Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                inputMode="email"
                {...register('email')}
                placeholder={t('auth.emailOrPhonePlaceholder')}
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
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" variant="outline" className="w-full" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.signInWithEmail')}
            </Button>
            <div className="text-center text-sm space-y-2">
              <div>
                <Link href="/auth/forgot-password" className="text-primary hover:underline">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div>
                <span className="text-gray-600">{t('auth.noAccount')} </span>
                <Link href="/auth/signup" className="text-primary hover:underline">
                  {t('auth.createAccountLink')}
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
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
      <LoginFormInner />
    </Suspense>
  )
}
