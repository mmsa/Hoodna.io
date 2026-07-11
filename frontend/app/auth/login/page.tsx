'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import Cookies from 'js-cookie'
import Link from 'next/link'
import { getPostAuthWebRoute } from '@/lib/resident-routing'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Security: Remove sensitive data from URL immediately
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const hasSensitiveData = url.searchParams.has('password')
      
      if (hasSensitiveData) {
        // Remove password from URL
        url.searchParams.delete('password')
        // Replace URL without sensitive data
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
      // Only pre-fill email - NEVER password
      email: searchParams?.get?.('email') || '',
      password: '', // Always empty - never from URL
    },
  })

  const onSubmit = async (data: LoginForm) => {
    setError('')
    setLoading(true)

    try {
      // Clear any existing cookies first to prevent cross-user issues
      Cookies.remove('access_token', { path: '/' })
      Cookies.remove('refresh_token', { path: '/' })

      const response = await api.post('/api/auth/login', data)
      const { access_token, refresh_token } = response.data

      // Verify we got valid tokens
      if (!access_token || !refresh_token) {
        setError('Failed to receive authentication tokens')
        return
      }

      // Set cookies with proper options to prevent cross-user issues
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

      // Force a hard refresh to clear all React Query caches and state
      // This ensures we don't show stale user data from a previous session
      const me = await api.get('/api/auth/me')
      const dest = getPostAuthWebRoute(me.data)
      if (typeof window !== 'undefined') {
        window.location.href = dest
      } else {
        router.push(dest)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      // Provide more detailed error messages
      if (err.response) {
        // Backend returned an error response
        const errorDetail = err.response?.data?.detail || err.response?.data?.message || 'Login failed'
        setError(errorDetail)
      } else if (err.request) {
        // Request was made but no response received (network/CORS issue)
        setError('Unable to connect to server. Please check your connection and try again.')
      } else {
        // Something else went wrong
        setError(err.message || 'Login failed. Please try again.')
      }
      // Clear cookies on error
      Cookies.remove('access_token', { path: '/' })
      Cookies.remove('refresh_token', { path: '/' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <div className="text-center text-sm space-y-2">
              <div>
                <Link href="/auth/forgot-password" className="text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div>
                <span className="text-gray-600">Don't have an account? </span>
                <Link href="/auth/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
