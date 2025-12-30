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
import { Building2, Wrench, Shield } from 'lucide-react'
import api from '@/lib/api'
import Link from 'next/link'
import Cookies from 'js-cookie'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  role: z.enum(['RESIDENT', 'SERVICE_PROVIDER', 'COMPOUND_MOD'], {
    required_error: 'Please select an account type',
  }),
})

type SignupForm = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      // Only pre-fill safe fields (name, email, phone) - NEVER password
      name: searchParams.get('name') || '',
      email: searchParams.get('email') || '',
      phone: searchParams.get('phone') || '',
      password: '', // Always empty - never from URL
    },
  })

  const role = watch('role')

  const onSubmit = async (data: SignupForm) => {
    setError('')
    setLoading(true)

    try {
      // Clear any existing cookies first to prevent cross-user issues
      Cookies.remove('access_token', { path: '/' })
      Cookies.remove('refresh_token', { path: '/' })

      const response = await api.post('/api/auth/signup', data)
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

      // Redirect based on role
      if (typeof window !== 'undefined') {
        if (data.role === 'RESIDENT') {
          window.location.href = '/onboarding/compound-select'
        } else if (data.role === 'SERVICE_PROVIDER') {
          window.location.href = '/onboarding/provider'
        } else if (data.role === 'COMPOUND_MOD') {
          window.location.href = '/onboarding/moderator'
        }
      } else {
        if (data.role === 'RESIDENT') {
          router.push('/onboarding/compound-select')
        } else if (data.role === 'SERVICE_PROVIDER') {
          router.push('/onboarding/provider')
        } else if (data.role === 'COMPOUND_MOD') {
          router.push('/onboarding/moderator')
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Signup failed')
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
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Join your verified neighborhood community</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
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
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                placeholder="+20 123 456 7890"
              />
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

            {/* Role Selection */}
            <div className="space-y-3">
              <Label htmlFor="role">Account Type <span className="text-red-500">*</span></Label>
              <input
                type="hidden"
                {...register('role')}
              />
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('RESIDENT')
                    setValue('role', 'RESIDENT')
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    role === 'RESIDENT'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${role === 'RESIDENT' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Building2 className={`w-5 h-5 ${role === 'RESIDENT' ? 'text-blue-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Resident</div>
                      <div className="text-xs text-gray-600">Live in a compound</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('SERVICE_PROVIDER')
                    setValue('role', 'SERVICE_PROVIDER')
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    role === 'SERVICE_PROVIDER'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${role === 'SERVICE_PROVIDER' ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Wrench className={`w-5 h-5 ${role === 'SERVICE_PROVIDER' ? 'text-green-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Service Provider</div>
                      <div className="text-xs text-gray-600">Provide services to residents</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('COMPOUND_MOD')
                    setValue('role', 'COMPOUND_MOD')
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    role === 'COMPOUND_MOD'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${role === 'COMPOUND_MOD' ? 'bg-purple-100' : 'bg-gray-100'}`}>
                      <Shield className={`w-5 h-5 ${role === 'COMPOUND_MOD' ? 'text-purple-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Compound Moderator</div>
                      <div className="text-xs text-gray-600">Moderate content for your compound</div>
                    </div>
                  </div>
                </button>
              </div>
              {errors.role && (
                <p className="text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || !role}>
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

